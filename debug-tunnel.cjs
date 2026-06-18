const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  
  // Simulate ball-brick collision check at various positions
  const result = await page.evaluate(() => {
    const BALL_R = 7;
    const SUB_STEP_MAX = 4;
    
    // Brick at (160, 100), w=64, h=24 → x:[128,192], y:[88,112]
    const brick = { x: 160, y: 100, w: 64, h: 24 };
    
    // Ball at y=100 (center of brick vertically), moving right at speed 4
    // Check collision at each position as ball approaches brick
    const positions = [140, 144, 148, 152, 156, 160, 164, 168];
    const results = [];
    
    for (const bx of positions) {
      const closestX = Math.max(brick.x - brick.w / 2, Math.min(bx, brick.x + brick.w / 2));
      const closestY = Math.max(brick.y - brick.h / 2, Math.min(100, brick.y + brick.h / 2));
      const dx = bx - closestX;
      const dy = 100 - closestY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const collides = (dx*dx + dy*dy) < (BALL_R * BALL_R);
      results.push({ x: bx, closestX, dist: dist.toFixed(1), collides });
    }
    
    // Now simulate sub-stepping (4px per step)
    let ballX = 140;
    const stepResults = [];
    for (let step = 0; step < 10; step++) {
      ballX += 4;
      const closestX = Math.max(brick.x - brick.w / 2, Math.min(ballX, brick.x + brick.w / 2));
      const closestY = Math.max(brick.y - brick.h / 2, Math.min(100, brick.y + brick.h / 2));
      const dx = ballX - closestX;
      const dy = 100 - closestY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const collides = (dx*dx + dy*dy) < (BALL_R * BALL_R);
      stepResults.push({ step, x: ballX, dist: dist.toFixed(1), collides });
      if (collides) break;
    }
    
    return { positions: results, subSteps: stepResults };
  });
  
  console.log('Position check:');
  result.positions.forEach(r => console.log(`  x=${r.x}: dist=${r.dist}, collides=${r.collides}`));
  console.log('\nSub-step simulation:');
  result.subSteps.forEach(r => console.log(`  step=${r.step}, x=${r.x}: dist=${r.dist}, collides=${r.collides}`));
  
  await browser.close();
})();
