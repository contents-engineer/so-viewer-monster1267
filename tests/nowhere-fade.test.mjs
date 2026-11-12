import test from 'node:test';
import assert from 'node:assert/strict';
import { createFade, FADE_MS } from '../public/src/nowhere/fade.js';

test('(a) fadeTo: 문구 · 전환 시간 · is-on 을 바꾸고 ms 뒤에 끝난다 · setText 는 문구만', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const node = () => {
    const cls = new Set();
    const children = [];
    return {
      textContent: '',
      className: '',
      style: {},
      children,
      append(...c) {
        children.push(...c);
      },
      classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) },
    };
  };
  const appended = [];
  globalThis.document = { createElement: node, body: { append: (n) => appended.push(n) } };
  try {
    assert.equal(FADE_MS, 600);
    const f = createFade();
    assert.deepEqual(appended, [f.element]);
    assert.equal(f.element.className, 'nw-fade');
    const text = f.element.children[0];
    assert.equal(text.className, 'nw-fade-text');
    let done = false;
    const p = f.fadeTo(true, '실내로 들어가는 중…', 300).then(() => {
      done = true;
    });
    assert.equal(f.element.classList.contains('is-on'), true);
    assert.equal(f.element.style.transitionDuration, '300ms');
    assert.equal(text.textContent, '실내로 들어가는 중…');
    t.mock.timers.tick(299);
    await Promise.resolve();
    assert.equal(done, false);
    t.mock.timers.tick(1);
    await p;
    assert.equal(done, true);
    f.setText('50%');
    assert.equal(text.textContent, '50%');
    assert.equal(f.element.classList.contains('is-on'), true, 'setText 는 상태를 바꾸지 않는다');
    const q = f.fadeTo(false);
    assert.equal(f.element.classList.contains('is-on'), false);
    assert.equal(f.element.style.transitionDuration, `${FADE_MS}ms`);
    assert.equal(text.textContent, '');
    t.mock.timers.tick(FADE_MS);
    await q;
  } finally {
    delete globalThis.document;
  }
});
