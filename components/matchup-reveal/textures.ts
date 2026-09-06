import * as THREE from 'three';

export const CARD_W = 2.9;
export const CARD_H = 3.9;

/* photo -> texture, cover-cropped with a red grade and bottom falloff */
export function textureFromFile(file: File): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('not an image'));
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 1024;
        c.height = Math.round((1024 * CARD_H) / CARD_W);
        const x = c.getContext('2d')!;
        const s = Math.max(c.width / img.width, c.height / img.height);
        const w = img.width * s,
          h = img.height * s;
        x.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
        const g = x.createLinearGradient(0, c.height * 0.42, 0, c.height);
        g.addColorStop(0, 'rgba(5,4,5,0)');
        g.addColorStop(1, 'rgba(5,4,5,0.82)');
        x.fillStyle = g;
        x.fillRect(0, 0, c.width, c.height);
        x.globalCompositeOperation = 'overlay';
        x.fillStyle = 'rgba(120,10,6,0.24)';
        x.fillRect(0, 0, c.width, c.height);
        x.globalCompositeOperation = 'source-over';
        const t = new THREE.CanvasTexture(c);
        t.anisotropy = 8; // sharp when angled toward camera
        t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        resolve(t);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function placeholderTexture(letter: string, hex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 690;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 512, 690);
  g.addColorStop(0, '#2A0B09');
  g.addColorStop(1, '#0A0505');
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 690);
  x.strokeStyle = hex;
  x.lineWidth = 6;
  x.strokeRect(18, 18, 476, 654);
  x.fillStyle = hex;
  x.font = '700 250px Archivo Black, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(letter, 256, 355);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* VS drawn to a canvas so it lives in the 3D scene and picks up bloom */
export function vsTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 1024, 512);
  x.font = '700 420px Archivo Black, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const g = x.createLinearGradient(0, 60, 0, 452);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.42, '#C9BDBA');
  g.addColorStop(0.55, '#6E5F5C');
  g.addColorStop(1, '#ffffff');
  x.fillStyle = g;
  x.fillText('VS', 512, 268);
  x.lineWidth = 10;
  x.strokeStyle = '#E10600';
  x.strokeText('VS', 512, 268);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
