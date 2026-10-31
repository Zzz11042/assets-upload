import json, os, time, urllib.request
API='https://apihub.agnes-ai.com/v1/images/generations'
KEY='sk-16XYmPcXAqDCjcL97C8iVLHk6ZMUzltKHFpSnpzEiax3V6Ol'
HDRS={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'}
def gen(desc, out, size='512x512'):
    if os.path.exists(out) and os.path.getsize(out)>1000:
        print(f'{out}: exists'); return
    payload={'model':'agnes-image-2.5-flash','prompt':desc,'size':size,'n':1}
    data=json.dumps(payload).encode()
    r=urllib.request.Request(API,data=data,headers=HDRS,method='POST')
    with urllib.request.urlopen(r,timeout=120) as resp:
        p=json.loads(resp.read())
    if 'error' in p:
        print(f'{out}: API error {p}'); return
    url=p['data'][0]['url']
    with urllib.request.urlopen(url,timeout=60) as resp:
        open(out,'wb').write(resp.read())
    print(f'{out}: {os.path.getsize(out)}B')

gen('emblem badge logo of a cozy pixel-art shopping mall building with a golden star on top, circular wooden sign with autumn leaves, Stardew Valley style, 16-bit pixel art, warm autumn colors, no text, no letters, isolated on solid white background', 'logo_new.png','512x512')
