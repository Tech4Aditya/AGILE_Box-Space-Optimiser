"""Smoke test the running BoxSpace backend. Start the server before running this."""
import json, urllib.request
BASE = 'http://127.0.0.1:8000'
def call(path, method='GET', payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=15) as r: return json.loads(r.read())
assert call('/api/health')['status'] == 'ok'
plan = call('/api/plan', 'POST', {'items':[{'sku':'TEST','name':'Test carton','qty':4,'length_cm':40,'width_cm':30,'height_cm':20,'weight_kg_each':10,'orientation':'any','fragile':False,'stackable':True,'max_stack_kg':100}], 'vehicle':{'L':590,'W':235,'H':239,'payload':24000}, 'strategy':'balanced'})
assert plan['valid'] and len(plan['placed']) == 4 and not plan['unplaced'], plan
trained = call('/api/ai/train','POST')
assert trained['status'] == 'trained'
risk = call('/api/ai/risk','POST',{'items':[{'id':'TEST-1','l':40,'w':30,'h':20,'weight':10,'fragile':True,'stackable':False}]})
assert len(risk['predictions']) == 1 and 0 <= risk['predictions'][0]['risk'] <= 1
cost = call('/api/route/cost','POST',{'distance_km':120,'duration_min':140,'mileage_kmpl':4,'diesel_price':90,'maintenance_per_km':5,'toll_estimate':200})
assert cost['total_cost'] == 3500
with urllib.request.urlopen(BASE+'/', timeout=10) as r: assert r.status == 200 and b'BoxSpace' in r.read()
print('PASS: health, packing, AI training, AI prediction, route costing, frontend serving')
