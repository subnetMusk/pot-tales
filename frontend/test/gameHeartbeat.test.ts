import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startGameHeartbeat } from '../src/network/gameHeartbeat.ts';

test('il ping continua senza update Phaser, non si sovrappone e si ferma allo shutdown', async () => {
    let tick!: () => void;
    let finish!: () => void;
    let current!: () => boolean;
    let calls = 0;
    let cancelled = 0;
    const stop = startGameHeartbeat(async valid => {
        calls++;
        current = valid;
        await new Promise<void>(resolve => { finish = resolve; });
    }, (fn, ms) => {
        assert.equal(ms, 7000);
        tick = fn;
        return 42;
    }, handle => {
        assert.equal(handle, 42);
        cancelled++;
    });
    tick(); tick();
    assert.equal(calls, 1);
    assert.equal(current(), true);
    finish();
    await new Promise(resolve => setImmediate(resolve));
    tick();
    assert.equal(calls, 2);
    stop(); stop();
    assert.equal(current(), false);
    tick();
    assert.equal(calls, 2);
    assert.equal(cancelled, 1);
    finish();
});

test('usa il timer del browser e lo cancella quando la scena chiude', async context => {
    context.mock.timers.enable({ apis: ['setInterval'] });
    let calls = 0;
    const stop = startGameHeartbeat(async () => { calls++; });
    context.mock.timers.tick(7000);
    assert.equal(calls, 1);
    await new Promise(resolve => setImmediate(resolve));
    stop();
    context.mock.timers.tick(14000);
    assert.equal(calls, 1);
});
