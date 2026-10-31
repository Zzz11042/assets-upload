import json, os, time, urllib.request
API='https://apihub.agnes-ai.com/v1/images/generations'
KEY='sk-16XYmPcXAqDCjcL97C8iVLHk6ZMUzltKHFpSnpzEiax3V6Ol'
HDRS={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'}

def gen(desc, out, size='256x256'):
    if os.path.exists(out) and os.path.getsize(out)>1000:
        print(f'{out}: exists'); return
    payload={'model':'agnes-image-2.5-flash','prompt':desc,'size':size,'n':1}
    data=json.dumps(payload).encode()
    r=urllib.request.Request(API,data=data,headers=HDRS,method='POST')
    with urllib.request.urlopen(r,timeout=120) as resp:
        p=json.loads(resp.read())
    if 'error' in p:
        print(f'{out}: API error {p}')
        return
    url=p['data'][0]['url']
    with urllib.request.urlopen(url,timeout=60) as resp:
        open(out,'wb').write(resp.read())
    print(f'{out}: {os.path.getsize(out)}B')

STYLE='16-bit pixel art game achievement badge icon, cozy Stardew Valley style, warm autumn palette, cute, simple, no text, no letters, isolated on solid white background'

ACHS=[
 ('ach_a_first','open storefront with a gold "open now" sign waving'),
 ('ach_a_ten','ten small shop buildings arranged in two rows, grand mall scene'),
 ('ach_a_maxed','golden crown atop a flagship store building'),
 ('ach_a_expand1','wooden signpost with arrows pointing to a small town'),
 ('ach_a_expand2','stone archway gate to a town street'),
 ('ach_a_expand3','busy town square with fountain and shops'),
 ('ach_a_expand4','grand city skyline with skyscrapers, empire style'),
 ('ach_a_50k','small pile of gold coins'),
 ('ach_a_100k','medium pile of gold coins and one gold bar'),
 ('ach_a_500k','huge gold treasure chest overflowing with coins'),
 ('ach_a_10day','wooden calendar showing a ten with a checkmark'),
 ('ach_a_30day','wooden calendar with a silver medal'),
 ('ach_a_20k','crowd of ten cute pixel people walking through a door'),
 ('ach_a_50k_c','dense crowd of pixel people cheering'),
 ('ach_a_all9','nine different tiny shop icons arranged in a circle'),
 ('ach_a_lv3','three level stars in ascending size'),
 ('ach_a_synergy','two linked golden gears with sparkles'),
 ('ach_a_allshop','three linked golden rings'),
 ('ach_a_5syn','five interlocking golden rings forming a chain'),
 ('ach_a_chain','three identical store fronts side by side with link chains'),
 ('ach_a_invest3','stock chart arrow rising through three stages with coins'),
 ('ach_a_20k_new','six different tiny shop icons in a row with a star'),
]
for name,desc in ACHS:
    gen(f'{desc}, {STYLE}', f'{name}.png')
    time.sleep(1)
print('ACH done, total:', len(os.listdir('.')))
