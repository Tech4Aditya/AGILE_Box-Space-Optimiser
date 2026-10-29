#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

struct Box {
    int id;
    double l, w, h;
};

struct Point {
    double x, y, z;
};

struct PlacedBox {
    Box box;
    double x, y, z;
};

struct Container {
    double l = 600;
    double w = 250;
    double h = 242;
};

bool overlaps(const PlacedBox& a, const PlacedBox& b) {
    bool overlapX =
        a.x < b.x + b.box.l &&
        a.x + a.box.l > b.x;

    bool overlapY =
        a.y < b.y + b.box.w &&
        a.y + a.box.w > b.y;

    bool overlapZ =
        a.z < b.z + b.box.h &&
        a.z + a.box.h > b.z;

    return overlapX && overlapY && overlapZ;
}

bool insideContainer(
    const Box& b,
    const Point& p,
    const Container& c
) {
    return p.x >= 0 &&
           p.y >= 0 &&
           p.z >= 0 &&
           p.x + b.l <= c.l &&
           p.y + b.w <= c.w &&
           p.z + b.h <= c.h;
}

bool canPlace(
    const Box& b,
    const Point& p,
    const Container& c,
    const vector<PlacedBox>& placed
) {
    if (!insideContainer(b, p, c))
        return false;

    PlacedBox candidate{b, p.x, p.y, p.z};

    for (const auto& existing : placed) {
        if (overlaps(candidate, existing))
            return false;
    }

    return true;
}

void addPoint(
    vector<Point>& points,
    double x,
    double y,
    double z
) {
    for (const auto& p : points) {
        if (p.x == x && p.y == y && p.z == z)
            return;
    }

    points.push_back({x, y, z});
}

vector<PlacedBox> packBoxes(
    vector<Box> boxes,
    const Container& container
) {
    // Larger boxes first: a simple greedy ordering.
    sort(boxes.begin(), boxes.end(),
         [](const Box& a, const Box& b) {
             return a.l * a.w * a.h >
                    b.l * b.w * b.h;
         });

    vector<PlacedBox> placed;

    // Initially, only the container's origin is available.
    vector<Point> points = {{0, 0, 0}};

    for (const auto& box : boxes) {
        bool found = false;

        // Prefer lower positions, then front-to-back,
        // then left-to-right.
        sort(points.begin(), points.end(),
             [](const Point& a, const Point& b) {
                 if (a.z != b.z) return a.z < b.z;
                 if (a.y != b.y) return a.y < b.y;
                 return a.x < b.x;
             });

        for (const auto& p : points) {
            if (!canPlace(box, p, container, placed))
                continue;

            // First valid placement wins.
            placed.push_back({box, p.x, p.y, p.z});

            // Generate candidate points around this box.
            addPoint(points, p.x + box.l, p.y, p.z);
            addPoint(points, p.x, p.y + box.w, p.z);
            addPoint(points, p.x, p.y, p.z + box.h);

            found = true;
            break;
        }

        if (!found) {
            cout << "Box " << box.id
                 << " could not be placed.\n";
        }
    }

    return placed;
}

int main() {
    Container container;

    vector<Box> boxes = {
        {1, 100, 80, 60},
        {2, 80, 60, 50},
        {3, 60, 50, 40}
    };

    auto result = packBoxes(boxes, container);

    cout << "\nLoading plan:\n";

    for (const auto& p : result) {
        cout << "Box " << p.box.id
             << " -> ("
             << p.x << ", "
             << p.y << ", "
             << p.z << ")\n";
    }

    cout << "Placed " << result.size()
         << " out of " << boxes.size()
         << " boxes.\n";

    return 0;
}