const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  
  // Simulate ball approaching brick from the LEFT, above brick's vertical range
  const result = await page.evaluate(() => {
    const BALL_R = 7;
    const SUB_STEP_MAX = 4;
    
    // Brick at (160, 100), w=64, h=24 → x:[128,192], y:[88,112]
    const brick = { x: 160, y: 100, w: 64, h: 24 };
    
    // Ball approaching from left, y=100 (center of brick)
    // This puts the ball INSIDE the brick's y-range, so closest point is on the left edge
    let ballX = 110;
    const steps = Math.ceil(4 / SUB_STEP_MAX); // speed=4, steps=1
    const svx = 4 / steps;
    
    console.log('Speed 4, steps=1, svx=4:');
    for (let s = 0; s < 20; s++) {
      ballX += svx;
      const closestX = Math.max(brick.x - brick.w / 2, Math.min(ballX, brick.x + brick.w / 2));
      const closestY = Math.max(brick.y - brick.h / 2, Math.min(100, brick.y + brick.h / 2));
      const dx = ballX - closestX;
      const dy = 100 - closestY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const collides = (dx*dx + dy*dy) < (BALL_R * BALL_R);
      console.log(`  x=${ballX.toFixed(1)}: closestX=${closestX}, dist=${dist.toFixed(1)}, collides=${collides}`);
      if (collides) { console.log('  >>> COLLISION FIRED'); break; }
    }
    
    // Now test with ball ABOVE the brick's y-range
    console.log('\nBall approaching from left, y=70 (above brick):');
    ballX = 110;
    for (let s = 0; s < 20; s++) {
      ballX += svx;
      const closestX = Math.max(brick.x - brick.w / 2, Math.min(ballX, brick.x + brick.w / 2));
      const closestY = Math.max(brick.y - brick.h / 2, Math.min(70, brick.y + brick.h / 2));
      const dx = ballX - closestX;
      const dy = 70 - closestY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const collides = (dx*dx + dy*dy) < (BALL_R * BALL_R);
      console.log(`  x=${ballX.toFixed(1)}: closest=(${closestX},${closestY}), dist=${dist.toFixed(1)}, collides=${collides}`);
      if (collides) { console.log('  >>> COLLISION FIRED'); break; }
    }
    
    // Test fast ball tunneling
    console.log('\nSpeed 6, steps=2, svx=3:');
    ballX = 110;
    const steps2 = Math.ceil(6 / SUB_STEP_MAX);
    const svx2 = 6 / steps2;
    for (let s = 0; s < 20; s++) {
      ballX += svx2;
      const closestX = Math.max(brick.x - brick.w / 2, Math.min(ballX, brick.x + brick.w / 2));
      const closestY = Math.max(brick.y - brick.h / 2, Math.min(100, brick.y + brick.h / 2));
      const dx = ballX - closestX;
      const dy = 100 - closestY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const collides = (dx*dx + dy*dy) < (BALL_R * BALL_R);
      console.log(`  x=${ballX.toFixed(1)}: dist=${dist.toFixed(1)}, collides=${collides}`);
      if (collides) { console.log('  >>> COLLISION FIRED'); break; }
    }
    
    // Test with ball at corner
    console.log('\nBall approaching brick corner (y=112):');
    ballX = 110;
    for (let s = 0; s < 20; s++) {
      ballX += svx;
      const closestX = Math.max(brick.x - brick.w / 2, Math.min(ballX, brick.x + brick.w / 2));
      const closestY = Math.max(brick.y - brick.h / 2, Math.min(112, brick.y + brick.h / 2));
      const dx = ballX - closestX;
      const dy = 112 - closestY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const collides = (dx*dx + dy*dy) < (BALL_R * BALL_R);
      console.log(`  x=${ballX.toFixed(1)}: dist=${dist.toFixed(1)}, collides=${collides}`);
      if (collides) { console.log('  >>> COLLISION FIRED'); break; }
    }
    
    return 'done';
  });
  
  await browser.close();
})();
