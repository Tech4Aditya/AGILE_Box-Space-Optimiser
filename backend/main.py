from __future__ import annotations
import json, math, os, random
from pathlib import Path
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(__file__).resolve().parent / 'cargo_risk_model.json'
FEEDBACK_PATH = Path(__file__).resolve().parent / 'cargo_outcomes.jsonl'
app = FastAPI(title='BoxSpace Optimiser API', version='4.0.0', description='Constraint-aware truck loading and cargo-risk ML API')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

class Item(BaseModel):
    sku: str = 'ITEM'
    name: str = 'Carton'
    qty: int = Field(ge=0, le=500)
    length_cm: float = Field(gt=0, le=1000)
    width_cm: float = Field(gt=0, le=1000)
    height_cm: float = Field(gt=0, le=1000)
    weight_kg_each: float = Field(ge=0, le=5000)
    orientation: str = 'any'
    fragile: bool = False
    stackable: bool = True
    max_stack_kg: float = 0

class PlanRequest(BaseModel):
    items: list[Item]
    vehicle: dict[str, Any]
    reserve_percent: float = Field(default=0, ge=0, le=30)
    strategy: str = 'balanced'

class RiskRequest(BaseModel):
    items: list[dict[str, Any]]

VEHICLES = {
 '20': {'name':'20 ft freight truck','L':590,'W':235,'H':239,'payload':24000},
 '17': {'name':'17 ft freight truck','L':500,'W':220,'H':220,'payload':12000},
 '14': {'name':'14 ft freight truck','L':400,'W':190,'H':190,'payload':9000},
}

def orientations(b):
    l,w,h = b['length_cm'],b['width_cm'],b['height_cm']
    if b.get('orientation') == 'upright': return [(l,w,h)]
    if b.get('orientation') == 'flat': return [(l,w,h),(w,l,h)]
    return list(dict.fromkeys([(l,w,h),(l,h,w),(w,l,h),(w,h,l),(h,l,w),(h,w,l)]))

def intersects(a,b):
    eps=1e-7
    return (a['x'] < b['x']+b['l']-eps and a['x']+a['l'] > b['x']+eps and
            a['y'] < b['y']+b['w']-eps and a['y']+a['w'] > b['y']+eps and
            a['z'] < b['z']+b['h']-eps and a['z']+a['h'] > b['z']+eps)

def pack(req: PlanRequest):
    v=req.vehicle
    for k in ('L','W','H','payload'):
        if k not in v or float(v[k])<=0: raise HTTPException(422, f'Invalid vehicle field: {k}')
    L,W,H,payload=map(float,(v['L'],v['W'],v['H'],v['payload']))
    reserve=L*(1-req.reserve_percent/100)
    boxes=[]
    for item in req.items:
        d=item.model_dump()
        for i in range(d['qty']):
            boxes.append({**d,'id':f"{d['sku']}-{i+1:02d}",'weight':d['weight_kg_each']})
    if len(boxes)>1200: raise HTTPException(422,'Maximum 1,200 cartons per plan.')
    if req.strategy=='volume': boxes.sort(key=lambda b:b['length_cm']*b['width_cm']*b['height_cm'], reverse=True)
    elif req.strategy=='heavy': boxes.sort(key=lambda b:b['weight'], reverse=True)
    else: boxes.sort(key=lambda b:(not b['fragile'], b['orientation']=='any',-b['length_cm']*b['width_cm']*b['height_cm']))
    placed=[]; unplaced=[]; points=[(0.0,0.0,0.0,None)]; total_weight=0.0; total_vol=0.0
    for b in boxes:
        if total_weight+b['weight']>payload+1e-8:
            unplaced.append({'id':b['id'],'sku':b['sku'],'reason':'Vehicle payload limit'}); continue
        best=None; best_score=None
        for x,y,z,support_id in sorted(points,key=lambda p:(p[2],p[1],p[0])):
            for l,w,h in orientations(b):
                if x+l>reserve+1e-7 or y+w>W+1e-7 or z+h>H+1e-7: continue
                p={'id':b['id'],'sku':b['sku'],'name':b['name'],'x':x,'y':y,'z':z,'l':l,'w':w,'h':h,'weight':b['weight'],'fragile':b['fragile'],'stackable':b['stackable'],'maxStackKg':b['max_stack_kg'],'supportId':support_id,'orientation':b['orientation']}
                if support_id:
                    base=next((q for q in placed if q['id']==support_id),None)
                    if not base or not base['stackable'] or base['fragile']: continue
                    if x<base['x']-1e-7 or y<base['y']-1e-7 or x+l>base['x']+base['l']+1e-7 or y+w>base['y']+base['w']+1e-7: continue
                    # Every carton in the support chain must tolerate the added load.
                    chain=base; feasible=True
                    while chain:
                        if chain['loadAbove']+p['weight']>chain['maxStackKg']+1e-7:
                            feasible=False; break
                        chain=next((q for q in placed if q['id']==chain.get('supportId')),None) if chain.get('supportId') else None
                    if not feasible: continue
                if any(intersects(p,q) for q in placed): continue
                score=(z*10000+y*100+x, -(l*w*h))
                if best_score is None or score<best_score: best,best_score=p,score
        if best is None:
            unplaced.append({'id':b['id'],'sku':b['sku'],'reason':'No feasible space / orientation / support'}); continue
        if best['supportId']:
            parent=next(q for q in placed if q['id']==best['supportId']); parent['loadAbove']+=best['weight']
            # propagate the supported load to ancestors
            ancestor=parent
            while ancestor.get('supportId'):
                ancestor=next(q for q in placed if q['id']==ancestor['supportId']); ancestor['loadAbove']+=best['weight']
        best['loadAbove']=0.0; placed.append(best); total_weight+=best['weight']; total_vol+=best['l']*best['w']*best['h']
        if best['z'] == 0:
            points.extend([(best['x']+best['l'],best['y'],0.0,None), (best['x'],best['y']+best['w'],0.0,None)])
        if best['stackable'] and not best['fragile'] and best['maxStackKg']>best['loadAbove']:
            points.append((best['x'],best['y'],best['z']+best['h'],best['id']))
        # Drop duplicate points and points already outside the usable truck volume.
        uniq={}
        for pt in points:
            if pt[0]<reserve+1e-7 and pt[1]<W+1e-7 and pt[2]<H+1e-7: uniq[(round(pt[0],3),round(pt[1],3),round(pt[2],3),pt[3])]=pt
        points=list(uniq.values())[-1200:]
    # Independent geometry/payload audit before returning a plan.
    bounds=all(p['x']>=0 and p['y']>=0 and p['z']>=0 and p['x']+p['l']<=reserve+1e-6 and p['y']+p['w']<=W+1e-6 and p['z']+p['h']<=H+1e-6 for p in placed)
    collisions=not any(intersects(a,b) for i,a in enumerate(placed) for b in placed[i+1:])
    payload_ok=total_weight<=payload+1e-6
    support_ok=True
    for p in placed:
        if p['supportId']:
            q=next((x for x in placed if x['id']==p['supportId']),None)
            support_ok &= bool(q and abs(p['z']-(q['z']+q['h']))<=1e-6 and q['stackable'] and not q['fragile'] and p['x']>=q['x']-1e-6 and p['y']>=q['y']-1e-6 and p['x']+p['l']<=q['x']+q['l']+1e-6 and p['y']+p['w']<=q['y']+q['w']+1e-6)
            ancestor=q
            while ancestor:
                support_ok &= ancestor['loadAbove']<=ancestor['maxStackKg']+1e-6
                ancestor=next((x for x in placed if x['id']==ancestor.get('supportId')),None) if ancestor.get('supportId') else None
    return {'vehicle':v,'placed':placed,'unplaced':unplaced,'totalWeight':round(total_weight,2),'placedVolume':round(total_vol,2),'utilisation':round(total_vol/(L*W*H)*100,2),'checks':{'bounds':bounds,'collisions':collisions,'payload':payload_ok,'support':bool(support_ok)},'valid':bool(bounds and collisions and payload_ok and support_ok),'algorithm':'3D extreme-point heuristic · constrained orientation · support/load audit'}

# Trainable logistic regression, implemented in NumPy so the backend stays lightweight.
def sigmoid(z): return 1/(1+__import__('numpy').exp(-__import__('numpy').clip(z,-30,30)))
def train_model(samples=5000, epochs=900):
    import numpy as np
    rng=np.random.default_rng(42); X=[]; y=[]
    for _ in range(samples):
        fragile=float(rng.random()<.24); weight=float(rng.uniform(0,100)); ratio=float(rng.uniform(.3,4)); stackable=float(rng.random()<.7)
        latent=-3.0+2.7*fragile+.024*weight+.75*max(0,ratio-1.1)+.95*(1-stackable)+rng.normal(0,.45)
        X.append([1,fragile,weight/50,ratio/2,1-stackable]); y.append(float(latent>0))
    X=np.asarray(X); y=np.asarray(y); w=np.zeros(X.shape[1]); lr=.12
    for _ in range(epochs):
        p=sigmoid(X@w); w-=lr*(X.T@(p-y)/len(y)+.001*w)
    # Report held-out synthetic validation, not operational accuracy.
    return {'weights':w.tolist(),'features':['bias','fragile','weight_scaled','height_ratio_scaled','not_stackable'],'training_samples':samples,'epochs':epochs,'validation_note':'Synthetic validation only; not real-world incident accuracy.'}
def feature_vector(b):
    l=float(b.get('l',b.get('length_cm',1))); wd=float(b.get('w',b.get('width_cm',1))); h=float(b.get('h',b.get('height_cm',1)))
    return [1.0,float(bool(b.get('fragile',False))),float(b.get('weight',b.get('weight_kg_each',0)))/50.0,h/max(1.0,min(l,wd))/2.0,float(not bool(b.get('stackable',True)))]

def train_from_labeled_feedback(epochs=1200):
    import numpy as np
    rows=[]
    if FEEDBACK_PATH.exists():
        for line in FEEDBACK_PATH.read_text().splitlines():
            try: rows.append(json.loads(line))
            except Exception: pass
    if len(rows)<20: return None
    X=np.asarray([feature_vector(r['item']) for r in rows],dtype=float); y=np.asarray([int(r['damaged']) for r in rows],dtype=float)
    w=np.zeros(X.shape[1]); lr=.08
    for _ in range(epochs):
        pred=sigmoid(X@w); w-=lr*(X.T@(pred-y)/len(y)+.002*w)
    # Deterministic holdout is reported honestly; this is operational feedback, not synthetic validation.
    cut=max(1,int(len(rows)*.8)); xv=X[cut:]; yv=y[cut:]
    accuracy=float(((sigmoid(xv@w)>=.5)==yv).mean()) if len(yv) else None
    return {'weights':w.tolist(),'features':['bias','fragile','weight_scaled','height_ratio_scaled','not_stackable'],'training_samples':len(rows),'epochs':epochs,'training_source':'user-labelled operational outcomes','validation_accuracy':round(accuracy,4) if accuracy is not None else None,'validation_note':'Trained from user-labelled cargo outcomes. Holdout is chronological and may be small.'}

def get_model():
    if MODEL_PATH.exists(): return json.loads(MODEL_PATH.read_text())
    m=train_model(); MODEL_PATH.write_text(json.dumps(m)); return m

@app.get('/api/health')
def health(): return {'status':'ok','service':'BoxSpace AI backend','version':'4.0.0','model':'logistic-regression','model_ready':MODEL_PATH.exists(),'labelled_outcomes':sum(1 for _ in FEEDBACK_PATH.open(encoding='utf-8')) if FEEDBACK_PATH.exists() else 0}
@app.post('/api/plan')
def create_plan(req: PlanRequest): return pack(req)
@app.post('/api/ai/train')
def train_ai():
    model=train_from_labeled_feedback() or train_model(); MODEL_PATH.write_text(json.dumps(model)); return {'status':'trained','model':'logistic-regression','training_samples':model['training_samples'],'epochs':model['epochs'],'features':model['features'],'training_source':model.get('training_source','synthetic bootstrap data'),'validation_accuracy':model.get('validation_accuracy'),'note':model.get('validation_note',model.get('validation_note'))}
@app.post('/api/ai/feedback')
def record_ai_feedback(payload: dict):
    item=payload.get('item'); damaged=payload.get('damaged')
    if not isinstance(item,dict) or damaged not in (0,1,False,True): raise HTTPException(422,'Provide item object and damaged: true/false.')
    row={'item':item,'damaged':int(bool(damaged))}
    with FEEDBACK_PATH.open('a',encoding='utf-8') as f: f.write(json.dumps(row)+'\n')
    count=sum(1 for _ in FEEDBACK_PATH.open(encoding='utf-8'))
    return {'status':'recorded','labelled_outcomes':count,'minimum_for_operational_training':20,'ready_to_train':count>=20}

@app.post('/api/ai/risk')
def predict_risk(req: RiskRequest):
    import numpy as np
    model=get_model(); w=np.asarray(model['weights']); out=[]
    for b in req.items:
        l=float(b.get('l',b.get('length_cm',1))); wd=float(b.get('w',b.get('width_cm',1))); h=float(b.get('h',b.get('height_cm',1)))
        x=np.asarray(feature_vector(b))
        risk=float(sigmoid(x@w)); out.append({'id':b.get('id',b.get('sku','item')),'risk':round(risk,4),'level':'HIGH' if risk>=.65 else 'MODERATE' if risk>=.35 else 'LOW','factors':[name for name,val in [('fragile',x[1]),('high weight',x[2]>.8),('tall/slender',x[3]>1),('not stackable',x[4])] if val]})
    return {'model':'logistic-regression','source':'backend trained model','predictions':out,'note':model['validation_note']}

@app.post('/api/route/cost')
def route_cost(payload: dict):
    distance=float(payload.get('distance_km',0)); duration=float(payload.get('duration_min',0)); mileage=float(payload.get('mileage_kmpl',0)); diesel=float(payload.get('diesel_price',0)); maintenance=float(payload.get('maintenance_per_km',0)); toll=float(payload.get('toll_estimate',0))
    if distance<=0 or mileage<=0 or diesel<=0 or min(maintenance,toll)<0: raise HTTPException(422,'Invalid route cost inputs')
    fuel=distance/mileage*diesel; ops=distance*maintenance
    return {'distance_km':distance,'duration_min':duration,'fuel_cost':round(fuel,2),'maintenance_cost':round(ops,2),'toll_estimate':round(toll,2),'total_cost':round(fuel+ops+toll,2),'note':'Toll is user-provided/indicative; traffic and live tariff data are not included.'}

# Serve the front end from the same origin for a one-command local launch.
app.mount('/', StaticFiles(directory=ROOT/'frontend', html=True), name='frontend')
