import * as THREE from 'three';
import { RARITY_LABELS } from './cardData.js';

export function makePackTexture() {
  const W = 512, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#031a4a');
  grad.addColorStop(0.5, '#0a2d8e');
  grad.addColorStop(1, '#020d24');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(60,140,255,0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (H / 12) * i);
    ctx.lineTo(W, (H / 12) * i);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo((W / 8) * i, 0);
    ctx.lineTo((W / 8) * i, H);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(60,140,255,0.8)';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.strokeStyle = 'rgba(120,180,255,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, W - 60, H - 60);

  const starGrad = ctx.createRadialGradient(W / 2, H * 0.35, 20, W / 2, H * 0.35, 140);
  starGrad.addColorStop(0, 'rgba(255,220,80,0.9)');
  starGrad.addColorStop(0.5, 'rgba(80,160,255,0.5)');
  starGrad.addColorStop(1, 'rgba(0,40,200,0)');
  ctx.fillStyle = starGrad;
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.35, 140, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(60,140,255,1)';
  ctx.shadowBlur = 30;
  ctx.fillText('TCG', W / 2, H * 0.35);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 28px Arial';
  ctx.letterSpacing = '8px';
  ctx.fillText('BOOSTER PACK', W / 2, H * 0.52);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '18px Arial';
  ctx.fillText('5 Cards Inside', W / 2, H * 0.6);

  const tearGrad = ctx.createLinearGradient(0, H * 0.08, 0, H * 0.14);
  tearGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
  tearGrad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  tearGrad.addColorStop(1, 'rgba(255,255,255,0.1)');
  ctx.fillStyle = tearGrad;
  ctx.fillRect(40, H * 0.08, W - 80, H * 0.06);

  return new THREE.CanvasTexture(canvas);
}

export function makeCardFrontTexture(data, artImage = null) {
  const W = 512, H = 716;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const isLegendary = data.rarity === 'legendary';
  const isRare = data.rarity === 'rare';

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, data.primaryColor);
  bg.addColorStop(1, data.secondaryColor);
  ctx.fillStyle = bg;
  ctx.roundRect(0, 0, W, H, 24);
  ctx.fill();

  if (isLegendary || isRare) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = 2 + Math.random() * 4;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const borderW = isLegendary ? 10 : 6;
  if (isLegendary) {
    const metalGrad = ctx.createLinearGradient(0, 0, W, H);
    metalGrad.addColorStop(0, '#F9E547');
    metalGrad.addColorStop(0.25, '#F5C518');
    metalGrad.addColorStop(0.5, '#FFF176');
    metalGrad.addColorStop(0.75, '#F5C518');
    metalGrad.addColorStop(1, '#F9E547');
    ctx.strokeStyle = metalGrad;
  } else {
    ctx.strokeStyle = data.borderColor;
  }
  ctx.lineWidth = borderW;
  ctx.roundRect(borderW / 2, borderW / 2, W - borderW, H - borderW, 22);
  ctx.stroke();

  const artH = H * 0.42;
  const artY = 72;

  if (artImage) {
    // Dark art background — prevents halo around Pokémon transparent edges
    ctx.fillStyle = '#08081a';
    ctx.beginPath();
    ctx.roundRect(20, artY, W - 40, artH, 8);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(20, artY, W - 40, artH, 8);
    ctx.clip();
    const maxSize = Math.min(W - 50, artH - 10);
    ctx.drawImage(artImage, W / 2 - maxSize / 2, artY + (artH - maxSize) / 2, maxSize, maxSize);
    ctx.restore();
  } else {
    // Procedural gradient art for cards without an image
    const artGrad = ctx.createRadialGradient(W / 2, artY + artH / 2, 20, W / 2, artY + artH / 2, artH * 0.7);
    artGrad.addColorStop(0, data.accentColor);
    artGrad.addColorStop(0.6, data.primaryColor);
    artGrad.addColorStop(1, '#000000');
    ctx.fillStyle = artGrad;
    ctx.roundRect(20, artY, W - 40, artH, 8);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const cx = (W / 5) * i + W / 10;
      ctx.moveTo(cx - 20, artY + 10);
      ctx.lineTo(cx + 20, artY + artH - 10);
      ctx.lineWidth = 30 + i * 10;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${isLegendary ? 32 : 28}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (isLegendary) {
    ctx.shadowColor = data.accentColor;
    ctx.shadowBlur = 16;
  }
  ctx.fillText(data.name, W / 2, artY - 26);
  ctx.shadowBlur = 0;

  const rarityY = artY + artH + 18;
  const rarityColors = {
    legendary: ['#F5C518', '#FFF176'],
    rare: ['#5DADE2', '#AED6F1'],
    uncommon: ['#A569BD', '#D7BDE2'],
    common: ['#7DCEA0', '#D5F5E3'],
  };
  const [rc1, rc2] = rarityColors[data.rarity] || ['#aaa', '#ccc'];
  const rarityGrad = ctx.createLinearGradient(0, rarityY, W, rarityY);
  rarityGrad.addColorStop(0, rc1);
  rarityGrad.addColorStop(1, rc2);
  ctx.fillStyle = rarityGrad;
  ctx.font = 'bold 16px Arial';
  ctx.letterSpacing = '3px';
  ctx.fillText(RARITY_LABELS[data.rarity] || data.rarity.toUpperCase(), W / 2, rarityY);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '14px Arial';
  ctx.letterSpacing = '1px';
  ctx.fillText(data.type.toUpperCase(), W / 2, rarityY + 28);

  if (data.power != null) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.roundRect(20, rarityY + 46, W - 40, 2, 1);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('HP', 30, rarityY + 74);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(data.power, W - 30, rarityY + 74);
  }

  const descY = data.power != null ? rarityY + 100 : rarityY + 54;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = 'italic 13px Arial';
  ctx.textAlign = 'center';
  const words = data.description.split(' ');
  let line = '', lineY = descY;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > W - 50 && line !== '') {
      ctx.fillText(line.trim(), W / 2, lineY);
      line = word + ' ';
      lineY += 18;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), W / 2, lineY);

  return new THREE.CanvasTexture(canvas);
}

export function makeCardBackTexture() {
  const W = 512, H = 716;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0f0c29');
  bg.addColorStop(0.5, '#302b63');
  bg.addColorStop(1, '#24243e');
  ctx.fillStyle = bg;
  ctx.roundRect(0, 0, W, H, 24);
  ctx.fill();

  ctx.strokeStyle = 'rgba(74, 28, 173, 0.5)';
  ctx.lineWidth = 1.5;
  const spacing = 32;
  for (let y = 0; y < H; y += spacing) {
    for (let x = 0; x < W; x += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150,100,255,0.3)';
      ctx.fill();
    }
  }

  ctx.strokeStyle = 'rgba(160,100,255,0.7)';
  ctx.lineWidth = 6;
  ctx.roundRect(10, 10, W - 20, H - 20, 20);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,150,255,0.3)';
  ctx.lineWidth = 2;
  ctx.roundRect(18, 18, W - 36, H - 36, 16);
  ctx.stroke();

  const glow = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, 180);
  glow.addColorStop(0, 'rgba(180,100,255,0.5)');
  glow.addColorStop(0.6, 'rgba(100,40,200,0.2)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(180,100,255,1)';
  ctx.shadowBlur = 24;
  ctx.fillText('TCG', W / 2, H / 2);
  ctx.shadowBlur = 0;

  return new THREE.CanvasTexture(canvas);
}
