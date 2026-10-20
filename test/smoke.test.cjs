'use strict';
/**
 * Reproduction tests for the self-contained deployed index.html.
 * Run: node --test test/smoke.test.cjs
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(scripts.length<2)throw Error('Standalone HTML script blocks missing');
const ctx={module:{exports:{}},URL};
vm.runInNewContext(scripts[0],ctx);
const {DATA,PRESETS,rankScenarios,historicalCost,inspectUrl}=ctx.module.exports;

test('source includes study title and research limits',()=>{
  assert.match(html,/피싱 웹사이트 탐지에서 입력 특징을 줄이면/);
  assert.match(html,/실전 피싱/);
});
test('three models preserve 450 samples and paper F1',()=>{
  for(const p of Object.values(DATA)){
    assert.equal(p.tp+p.fn,183);
    assert.equal(p.fp+p.tn,267);
    assert.ok(Math.abs(2*p.tp/(2*p.tp+p.fn+p.fp)-p.f1)<.001);
  }
});
test('paper confusion matrices remain exact',()=>{
  assert.equal(DATA.url8.fn,44);assert.equal(DATA.url8.fp,82);
  assert.equal(DATA.ssl9.fn,25);assert.equal(DATA.ssl9.fp,20);
  assert.equal(DATA.all30.fn,19);assert.equal(DATA.all30.fp,12);
});
test('weighted errors are calculated, not fixed text',()=>{
  assert.equal(historicalCost(DATA.url8,5),302);
  assert.equal(historicalCost(DATA.ssl9,5),145);
  assert.equal(historicalCost(DATA.all30,5),107);
  assert.equal(rankScenarios(20)[0].id,'all30');
});
test('invalid schemes and credentials are rejected',()=>{
  for(const bad of ['', 'nonsense','javascript:alert(1)','file:///etc/passwd','https://user:secret@example.org/'])
    assert.equal(inspectUrl(bad).ok,false,bad);
});
test('sample URLs produce eight observations without classifying',()=>{
  for(const sample of Object.values(PRESETS)){
    const r=inspectUrl(sample);assert.equal(r.ok,true);
    assert.equal(r.fields.length,8);
    assert.equal('phishing' in r,false);assert.equal('score' in r,false);
  }
});
test('oversized URL does not throw',()=>{
  assert.equal(inspectUrl('https://example.org/'+'x'.repeat(2100)).ok,false);
});
test('negative or invalid weights are rejected',()=>{
  assert.throws(()=>historicalCost(DATA.url8,-1));
  assert.throws(()=>historicalCost(DATA.url8,NaN));
});
