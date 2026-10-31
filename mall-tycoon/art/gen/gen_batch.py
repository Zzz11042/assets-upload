import json, os, time, collections
import urllib.request
from PIL import Image

API='https://apihub.agnes-ai.com/v1/images/generations'
KEY='sk-16XYmPcXAqDCjcL97C8iVLHk6ZMUzltKHFpSnpzEiax3V6Ol'
HDRS={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'}

def req(payload):
    data=json.dumps(payload).encode()
    r=urllib.request.Request(API,data=data,headers=HDRS,method='POST')
    with urllib.request.urlopen(r,timeout=120) as resp:
        return json.loads(resp.read())

SHOPS=[
 ('cafe','cute pixel-art style building icon of a coffee shop with coffee cup, cozy warm brown and cream colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('supermarket','cute pixel-art style building icon of a supermarket store with shopping cart, green and white colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('gaming','cute pixel-art style building icon of an arcade game center with gamepad and neon lights, purple and blue colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('cinema','cute pixel-art style building icon of a movie theater with film strip and popcorn, red and dark colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('food','cute pixel-art style building icon of a food court restaurant with steaming noodle bowl, orange and red warm colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('bookstore','cute pixel-art style building icon of a bookstore with books on shelves, brown and green colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('gym','cute pixel-art style building icon of a fitness gym with dumbbell, green and gray colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('fashion','cute pixel-art style building icon of a fashion boutique with clothes hanger, pink and white colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('hotel','cute pixel-art style building icon of a boutique hotel with star and moon sign, purple and gold colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('bakery','cute pixel-art style building icon of a bakery with croissant and bread, golden brown and cream colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('pet','cute pixel-art style building icon of a pet clinic with cat face, warm brown and pink colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('pharmacy','cute pixel-art style building icon of a pharmacy drugstore with red cross sign, blue and white colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('bank','cute pixel-art style building icon of a bank with classical columns, gray stone and gold colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('IT','cute pixel-art style building icon of a tech gadget store with robot and screens, blue and dark colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
 ('Art','cute pixel-art style building icon of an art gallery with easel and painting palette, purple and warm colors, single building front view, flat design, simple, no text, no people, isolated on solid white background'),
]

def gen_one(name, desc):
    out=f'{name}_1024.png'
    if os.path.exists(out) and os.path.getsize(out)>1000:
        print(f'{name}: exists, skip')
        return out
    p=req({'model':'agnes-image-2.5-flash','prompt':desc,'size':'512x512','n':1})
    url=p['data'][0]['url']
    with urllib.request.urlopen(url,timeout=60) as r:
        open(out,'wb').write(r.read())
    print(f'{name}: generated {os.path.getsize(out)}B')
    return out

for i,(name,desc) in enumerate(SHOPS):
    try:
        gen_one(name,desc)
    except Exception as e:
        print(f'{name}: ERROR {e}')
    time.sleep(2)
print('batch done')
