#!/usr/bin/env python3
"""
InvoiceFlow HTML Validator — run before every deploy
Usage: python3 validate.py invoiceflow-pro.html
"""
import sys, re, subprocess, os
from collections import Counter

def check(label, ok, msg=''):
    icon = '✅' if ok else '❌'
    print(f"{icon} {label}" + (f": {msg}" if msg else ''))
    return ok

def validate(path):
    print(f"\n{'═'*50}")
    print(f"  InvoiceFlow Validator — {os.path.basename(path)}")
    print(f"{'═'*50}\n")
    
    with open(path,'r',encoding='utf-8') as f:
        html = f.read()
    
    errors = 0

    # 1. Single style block
    styles = re.findall(r'<style>', html)
    if not check("Single <style> block", len(styles)==1, f"{len(styles)} found"):
        errors += 1

    # 2. CSS brace balance
    css_m = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
    css = css_m.group(1) if css_m else ''
    opens, closes = css.count('{'), css.count('}')
    if not check("CSS braces balanced", opens==closes, f"{{ {opens} }} {closes}"):
        errors += 1

    # 3. CSS vars defined
    defined_vars = set(re.findall(r'--(\w[\w-]+)\s*:', css))
    used_vars = set(re.findall(r'var\(--([^)]+)\)', html))
    missing_vars = used_vars - defined_vars
    if not check("CSS variables all defined", not missing_vars, f"missing: {missing_vars}"):
        errors += 1

    # 4. Critical CSS classes
    REQUIRED_CLASSES = ['layout','sb','content','topbar','view','kpi','card','btn',
        'bp','bg','bd','bs','bc','bsm','inp','g2','g3','g4','badge','tg','tr','tb','tk',
        'ta','tc','chip','chip-on','chip-off','icard','iav','iinfo','inm','isub','iact',
        'modal-ov','modal','proj-card','ins-card','text-card','tx-card','api-row',
        'pbar','pfill','drop-z','na','ni','up','am','view-toolbar','mb4']
    defined_cls = set(re.findall(r'\.([\w][\w-]+)[\s{,]', css))
    missing_cls = [c for c in REQUIRED_CLASSES if c not in defined_cls]
    if not check("Required CSS classes present", not missing_cls, f"missing: {missing_cls}"):
        errors += 1

    # 5. All views present
    REQUIRED_VIEWS = ['v-dashboard','v-invoices','v-belege','v-banking','v-projekte',
        'v-zeit','v-chatbot','v-forecast','v-insurance','v-ins-portal',
        'v-kunden','v-artikel','v-texte','v-users','v-analytics','v-settings']
    views = set(re.findall(r'id="(v-[^"]+)"', html))
    missing_views = [v for v in REQUIRED_VIEWS if v not in views]
    if not check(f"All 16 views present ({len(views)} found)", not missing_views, f"missing: {missing_views}"):
        errors += 1

    # 6. No duplicate IDs
    ids = re.findall(r'id="([^"]+)"', html)
    dupes = {k:v for k,v in Counter(ids).items() if v>1}
    if not check("No duplicate IDs", not dupes, f"dupes: {list(dupes.keys())[:5]}"):
        errors += 1

    # 7. JS syntax check
    script_m = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
    js = script_m.group(1) if script_m else ''
    if js:
        MOCK = "var window={};var localStorage={_d:{},getItem:function(k){return this._d[k]||null;},setItem:function(k,v){this._d[k]=v;},removeItem:function(k){delete this._d[k];}};var document={getElementById:function(){return{style:{},innerHTML:'',textContent:'',value:'',className:'',checked:false,classList:{add:function(){},remove:function(){},contains:function(){return false;}},dataset:{},options:[{value:'v',getAttribute:function(){return null;}}],selectedIndex:0,getAttribute:function(){return null;},addEventListener:function(){},querySelector:function(){return this;},querySelectorAll:function(){return{forEach:function(){},length:0};},appendChild:function(){},remove:function(){},getContext:function(){return{clearRect:function(){},fillRect:function(){},beginPath:function(){},arc:function(){},fill:function(){},stroke:function(){},save:function(){},restore:function(){},canvas:{offsetWidth:100}};},scrollTop:0,childNodes:[],children:{length:0},firstChild:null,lastChild:null};},querySelector:function(){return this.getElementById('x');},querySelectorAll:function(){return{forEach:function(){},length:0};},createElement:function(){return this.getElementById('x');},addEventListener:function(){},body:{appendChild:function(){},removeChild:function(){}},execCommand:function(){return true;}};var navigator={clipboard:{writeText:function(){return Promise.resolve();}}};var Chart=function(){this.destroy=function(){};};var FileReader=function(){this.readAsDataURL=function(){};};var fetch=function(){return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve({content:[{text:'{}'}]});},text:function(){return Promise.resolve('{}');}});};var setTimeout=function(){return 0;};var clearTimeout=function(){};var setInterval=function(){return 0;};var clearInterval=function(){};var console={log:function(){},warn:function(){},error:function(){}};var alert=function(){};var confirm=function(){return true;};var prompt=function(){return '';};var JSON=global.JSON;var Math=global.Math;var Date=global.Date;var parseInt=global.parseInt;var parseFloat=global.parseFloat;var isNaN=global.isNaN;var Number=global.Number;var String=global.String;var Promise=global.Promise;var ArrayBuffer=global.ArrayBuffer;"
        test = MOCK + '\n' + js
        with open('/tmp/_validate_js.js','w') as f:
            f.write(test)
        r = subprocess.run(['node','--check','/tmp/_validate_js.js'], capture_output=True, text=True, timeout=30)
        if not check("JS syntax valid", r.returncode==0, r.stderr.strip()[:80] if r.returncode else ''):
            errors += 1
        else:
            r2 = subprocess.run(['node','/tmp/_validate_js.js'], capture_output=True, text=True, timeout=30)
            if not check("JS runtime OK", r2.returncode==0, r2.stderr.strip()[:80] if r2.returncode else ''):
                errors += 1
    else:
        print("⚠  No inline script found")
        errors += 1

    print(f"\n{'─'*50}")
    if errors == 0:
        print(f"✅ ALL CHECKS PASSED — safe to deploy")
    else:
        print(f"❌ {errors} CHECK(S) FAILED — do not deploy")
    print(f"{'─'*50}\n")
    return errors == 0

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv)>1 else 'invoiceflow-pro.html'
    ok = validate(path)
    sys.exit(0 if ok else 1)
