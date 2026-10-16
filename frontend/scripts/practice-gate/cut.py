"""The owner's two paintings, cut into the gate's layers (plan 223).

  bg      the scene: its clock, its gate button, its pantograph's arms and
          head and its roof unit painted out (the app draws the first three,
          the car carries the last), a band of sky let in under the lamps so
          the painting fills the phone's taller gate
  near    the two pillars, in front of the car
  car     the standing car (its door open), the pantograph's base and the
          roof unit on its roof
  car2    the next cars, from the door-shut painting, for the train passing

The paintings are 902 x 1743; the gate is their rows 115..1616, 2.3128 px
to a unit, with 173 rows of sky inserted at row 262. The layers are written
at 2 px to a unit: the gate 390 x 724 units, a car 340.71 x 360.17 at
(24.65, 195.86)."""
import numpy as np
import cv2
from PIL import Image

TOP, BOT, CUT, INS = 115, 1616, 262, 173
CAR_BOX = (57, 845, 395, 1228)          # x0, x1, y0, y1 in the painting


def thick_line(mask, p0, p1, w):
    cv2.line(mask, p0, p1, 255, w, lineType=cv2.LINE_AA)


def cut(source, work):
    O = np.asarray(Image.open(source / 'open.png').convert('RGB'))
    C = np.asarray(Image.open(source / 'closed.png').convert('RGB'))
    H, W = O.shape[:2]

    # ── what is painted out ──────────────────────────────────
    # the gate button, hugged: the app draws its own over it
    pill = np.zeros((H, W), np.uint8)
    cv2.rectangle(pill, (146 + 62, 1420), (762 - 62, 1546), 255, -1)
    cv2.circle(pill, (146 + 62, 1483), 63, 255, -1)
    cv2.circle(pill, (762 - 62, 1483), 63, 255, -1)

    # the pantograph's moving parts, its base and the roof unit
    env = np.zeros((H, W), np.uint8)
    head = np.zeros((H, W), np.uint8)
    cv2.rectangle(head, (164, 397), (370, 434), 255, -1)       # the head and its horns, under the wire
    moving = np.zeros((H, W), np.uint8)
    thick_line(moving, (266, 408), (177, 526), 30)             # the upper arm
    cv2.circle(moving, (177, 526), 20, 255, -1)                # the knee
    thick_line(moving, (177, 526), (326, 668), 32)             # the lower arm
    thick_line(moving, (298, 664), (270, 622), 16)             # the strut
    cv2.rectangle(env, (132, 652), (362, 712), 255, -1)        # the base
    cv2.rectangle(env, (412, 662), (720, 712), 255, -1)        # the roof unit
    # in those two boxes, only the things themselves (greys, darks), not the
    # trees between their feet: those stay the painting's, in the scene
    lum = O.mean(axis=2)
    chroma = O.max(axis=2).astype(int) - O.min(axis=2).astype(int)
    things = ((env > 0) & ((chroma < 28) | (lum < 70))).astype(np.uint8) * 255
    things = cv2.morphologyEx(things, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    things = cv2.dilate(things, np.ones((3, 3), np.uint8))
    env = cv2.bitwise_or(things, cv2.bitwise_or(moving, head))
    # what the app draws itself, and what the car carries: painted out of the
    # scene. The wire (rows 389..392) stays: the head is cut from row 395.
    fill = cv2.bitwise_or(cv2.bitwise_or(cv2.dilate(head, np.ones((5, 5), np.uint8)),
                                         cv2.dilate(moving, np.ones((9, 9), np.uint8))),
                          cv2.dilate(things, np.ones((5, 5), np.uint8)))
    fill[703:, :] = 0                                          # the car body stays: it moves with the car
    fill[:395, :] = 0                                          # and the wire stays, all of it
    fill = np.where(fill > 0, 255, 0).astype(np.uint8)

    # the trees: copied from the painting's own forest (shift-map), from the
    # forest only (the window stops above the lake and the roof, rows 702+);
    # the sky: a smooth membrane down to the tree line, its lower edge the
    # copied trees, so the two meet without a seam; the lake's row: its row
    X0, X1, Y0, Y1 = 60, 840, 330, 702
    SKY = 552
    win = np.ascontiguousarray(O[Y0:Y1, X0:X1])
    hole = fill[Y0:Y1, X0:X1] > 0
    lab = cv2.cvtColor(win, cv2.COLOR_RGB2Lab)
    dst = np.zeros_like(lab)
    cv2.xphoto.inpaint(lab, np.where(hole, 0, 255).astype(np.uint8), dst, cv2.xphoto.INPAINT_SHIFTMAP)
    t = win.astype(np.float32)
    t[hole] = cv2.cvtColor(dst, cv2.COLOR_Lab2RGB).astype(np.float32)[hole]
    sky = hole.copy()
    sky[SKY - Y0:] = False
    h = cv2.inpaint(t.astype(np.uint8), sky.astype(np.uint8) * 255, 11, cv2.INPAINT_TELEA).astype(np.float32)
    for _ in range(1500):
        avg = (np.roll(h, 1, 0) + np.roll(h, -1, 0) + np.roll(h, 1, 1) + np.roll(h, -1, 1)) / 4
        h[sky] = avg[sky]
    t[sky] = h[sky]
    bg = O.copy()
    bg[Y0:Y1, X0:X1][hole] = np.clip(t, 0, 255).astype(np.uint8)[hole]
    row = fill[Y1] > 0
    xs_ok = np.where(~row)[0]
    for x in np.where(row)[0]:
        bg[Y1, x] = O[Y1, xs_ok[np.argmin(np.abs(xs_ok - x))]]
    bg = cv2.inpaint(bg, pill, 11, cv2.INPAINT_TELEA)
    # the clock's face, under its rod (which stays): the sky beside it, row by row
    for y in range(248, 378):
        if y < 260:
            bg[y, 728:779] = O[y, 724]
            bg[y, 796:845] = O[y, 724]
        else:
            bg[y, 728:845] = O[y, 724]

    # ── the objects' own matte, from their difference to what was behind ──
    diff = np.abs(O.astype(int) - bg.astype(int)).max(axis=2)
    alpha = np.clip((diff - 14) / 40.0, 0, 1)
    alpha[env == 0] = 0
    # inside the base and the roof unit, all of them (the matte only softens their edges)
    alpha[cv2.erode(things, np.ones((5, 5), np.uint8)) > 0] = 1
    alpha = cv2.GaussianBlur(alpha.astype(np.float32), (3, 3), 0)
    # the arms, the strut and the head are the app's (drawn so they can
    # move): out of the car, down to the base's top bar, which stays
    gone = cv2.dilate(cv2.bitwise_or(moving, head), np.ones((5, 5), np.uint8))
    gone[661:, :] = 0
    alpha[gone > 0] = 0

    # ── the car: from the roof line down to its skirt, between the pillars ──
    x0, x1, y0, y1 = CAR_BOX
    car_a = np.zeros((H, W), np.float32)
    car_a[703:y1, x0:x1] = 1.0
    car_a = np.maximum(car_a, alpha)
    car = np.dstack([O, (car_a * 255).astype(np.uint8)])[y0:y1, x0:x1]
    car2_a = np.zeros((H, W), np.float32)
    car2_a[705:y1, x0:x1] = 1.0
    car2 = np.dstack([C, (car2_a * 255).astype(np.uint8)])[y0:y1, x0:x1]

    # ── the pillars, in front ──
    near_a = np.zeros((H, W), np.uint8)
    near_a[:, 0:57] = 255
    near_a[:, 845:] = 255
    near_a[1436:1486, 0:74] = 255
    near_a[1436:1486, 828:] = 255
    near_rgb = O.copy()
    # the right pillar's first two columns still hold a little of the car's
    # blue stripe: grey them, so the stripe's colour (the line's) stops there
    edge = near_rgb[:, 845:847].astype(np.float32)
    lum2 = (edge * np.array([0.3, 0.59, 0.11])).sum(axis=2, keepdims=True)
    near_rgb[:, 845:847] = np.clip(np.repeat(lum2, 3, axis=2), 0, 255).astype(np.uint8)
    near = np.dstack([near_rgb, near_a])

    def let_in_sky(img):
        """Insert INS rows at CUT, each a copy of the row at CUT."""
        band = np.repeat(img[CUT:CUT + 1], INS, axis=0)
        return np.concatenate([img[:CUT], band, img[CUT:]], axis=0)

    k = 780 / W
    def save(arr, name):
        im = Image.fromarray(arr)
        im = im.resize((round(arr.shape[1] * k), round(arr.shape[0] * k)), Image.LANCZOS)
        im.save(work / f'{name}.png')

    save(let_in_sky(bg)[TOP:BOT + INS], 'bg')
    save(let_in_sky(near)[TOP:BOT + INS], 'near')
    save(car, 'car')
    save(car2, 'car2')
