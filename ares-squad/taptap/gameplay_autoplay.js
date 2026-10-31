(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const step = ms => (window.__gtStep ? window.__gtStep(ms) : null);

  window.addEventListener('load', async () => {
    await sleep(600);
    document.getElementById('onboard').style.display = 'none';
    document.getElementById('btnStart').click();
    await sleep(300);
    const ab = document.getElementById('btnAutoBattle');
    if (ab) ab.click();
    await sleep(200);

    for (let i = 0; i < 300; i++) {
      // Step 100ms chunks for smoother progression
      for (let j = 0; j < 2; j++) {
        const s = step(100);
        if (!s) { await sleep(500); break; }
        if (!s.inBattle) {
          // Battle ended — advance to next mission
          const dep = document.getElementById('btnDeploy');
          if (dep) dep.click();
          const ov = document.getElementById('resultOverlay');
          if (ov) ov.style.display = 'none';
          await sleep(100);
        }
        await sleep(20);
      }
    }
  });
})();
