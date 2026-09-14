"""Rebuild self-contained preview.html after editing source or JSON data.
Run with Python 3 from any directory. No external packages required.
"""
from pathlib import Path
import hashlib,json
out=Path(__file__).resolve().parents[1];src=out/'src'
master=(out/'character.master.svg').read_bytes()
rig=json.loads((out/'rig.json').read_text(encoding='utf-8'))
if hashlib.sha256(master).hexdigest()!=rig['masterSha256']:
    raise ValueError('Approved master hash differs. Audit the new master before binding this rig.')
page=(src/'preview.template.html').read_text(encoding='utf-8')
values={'PERFORMANCE':(src/'pose-performance.js').read_text(encoding='utf-8'),'INTERACTIONS':(src/'interactions.js').read_text(encoding='utf-8'),'LIPSYNC':(src/'lipsync-input.js').read_text(encoding='utf-8'),'EMOTION_EFFECTS':(src/'emotion-effects.js').read_text(encoding='utf-8'),'VARIANT_SVG':(out/'parts/limb-variants.svg').read_text(encoding='utf-8').split('?>',1)[1].strip(),'VARIANT_DATA':(out/'parts/variants.json').read_text(encoding='utf-8'),'VARIANTS':(src/'part-variants.js').read_text(encoding='utf-8'),'MESH':(src/'mesh-deformer.js').read_text(encoding='utf-8'),'CSS':(src/'preview.css').read_text(encoding='utf-8'),'SVG':master.decode('utf-8').split('?>',1)[1].strip(),'RUNTIME':(src/'rig-runtime.js').read_text(encoding='utf-8'),'APP':(src/'preview-app.js').read_text(encoding='utf-8'),'RIG':(out/'rig.json').read_text(encoding='utf-8'),'EXPRESSIONS':(out/'expressions.json').read_text(encoding='utf-8')}
for key,value in values.items():page=page.replace('__'+key+'__',value)
(out/'preview.html').write_bytes(page.encode('utf-8'))
print('preview.html rebuilt; approved master remains unchanged.')
