'use client';

import React, { useRef, useState, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
  ToneMapping,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { Director, type BeatKey } from './scene';
import { placeholderTexture, textureFromFile } from './textures';

type Labels = {
  soloA?: 'in' | 'out';
  soloB?: 'in' | 'out';
  plates?: boolean;
  eyebrow?: boolean;
};

export default function MatchupReveal() {
  const [names, setNames] = useState({
    a: 'Dancer A',
    b: 'Dancer B',
    ca: 'Crew',
    cb: 'Crew',
    round: 'Top 16',
  });
  const [texA, setTexA] = useState<THREE.Texture>(() => placeholderTexture('A', '#E10600'));
  const [texB, setTexB] = useState<THREE.Texture>(() => placeholderTexture('B', '#FF3B1F'));
  const [runId, setRunId] = useState(0);
  const [open, setOpen] = useState(false);
  const [fx, setFx] = useState({ bloom: 1.5, aberration: true, grain: true });
  const [labels, setLabels] = useState<Labels>({});
  const [error, setError] = useState('');
  const fileA = useRef<HTMLInputElement>(null);
  const fileB = useRef<HTMLInputElement>(null);

  const onBeat = React.useCallback((key: BeatKey) => {
    setLabels((l) => {
      const n = { ...l };
      if (key === 'soloA') n.soloA = 'in';
      if (key === 'soloAout') n.soloA = 'out';
      if (key === 'soloB') n.soloB = 'in';
      if (key === 'soloBout') n.soloB = 'out';
      if (key === 'vs') {
        n.plates = true;
        n.eyebrow = true;
      }
      return n;
    });
  }, []);

  const play = () => {
    setLabels({});
    setRunId((r) => r + 1);
  };

  const pick = async (which: 'a' | 'b', file: File | undefined) => {
    if (!file) return;
    try {
      const texture = await textureFromFile(file);
      if (which === 'a') setTexA(texture);
      else setTexB(texture);
      setError('');
    } catch (e) {
      setError('Photo failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="wrap">
      <div className="scene">
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ fov: 42, position: [0, 0.15, 13.2], near: 0.1, far: 140 }}
          onCreated={({ gl }) => {
            gl.setClearColor('#050405');
          }}
        >
          <Suspense fallback={null}>
            <Director key={runId} texA={texA} texB={texB} runId={runId} onBeat={onBeat} />
            <EffectComposer multisampling={0} enableNormalPass={false}>
              {/* selective-feeling bloom: threshold sits above the photos,
                  so only emissive rims, the seam, sparks and VS glow */}
              <Bloom
                intensity={fx.bloom}
                luminanceThreshold={0.62}
                luminanceSmoothing={0.28}
                mipmapBlur
                radius={0.82}
              />
              <ChromaticAberration offset={fx.aberration ? [0.0011, 0.0007] : [0, 0]} />
              <Noise opacity={fx.grain ? 0.055 : 0} blendFunction={BlendFunction.OVERLAY} />
              <Vignette eskil={false} offset={0.22} darkness={0.86} />
              <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            </EffectComposer>
          </Suspense>
        </Canvas>
      </div>

      <div className="vig" />
      {fx.grain && <div className="grain" />}

      <div className={'solo ' + (labels.soloA || '')}>
        <span className="stag">Side A</span>
        <span className="sname">{names.a}</span>
        <span className="screw">{names.ca}</span>
      </div>
      <div className={'solo ' + (labels.soloB || '')}>
        <span className="stag">Side B</span>
        <span className="sname">{names.b}</span>
        <span className="screw">{names.cb}</span>
      </div>

      <div className="hud">
        <div className={'eyebrow' + (labels.eyebrow ? ' on' : '')}>
          <i />
          <span>{names.round}</span>
          <i />
        </div>
        <div />
        <div className="plates">
          <div className={'plate' + (labels.plates ? ' in' : '')}>
            <span className="pname">{names.a}</span>
            <span className="pcrew">{names.ca}</span>
          </div>
          <div className={'plate b' + (labels.plates ? ' in' : '')}>
            <span className="pname">{names.b}</span>
            <span className="pcrew">{names.cb}</span>
          </div>
        </div>
      </div>

      <button className="toggle" onClick={() => setOpen((o) => !o)}>
        Setup
      </button>

      <aside className={'panel' + (open ? ' open' : '')}>
        <h2>Matchup setup</h2>
        <label>Round label</label>
        <input
          type="text"
          value={names.round}
          onChange={(e) => setNames({ ...names, round: e.target.value })}
        />
        <label>Side A — name</label>
        <input
          type="text"
          value={names.a}
          onChange={(e) => setNames({ ...names, a: e.target.value })}
        />
        <label>Side A — crew</label>
        <input
          type="text"
          value={names.ca}
          onChange={(e) => setNames({ ...names, ca: e.target.value })}
        />
        <label>Side A — photo</label>
        <div className="drop" onClick={() => fileA.current?.click()}>
          Choose image
        </div>
        <input
          ref={fileA}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pick('a', e.target.files?.[0])}
        />

        <label>Side B — name</label>
        <input
          type="text"
          value={names.b}
          onChange={(e) => setNames({ ...names, b: e.target.value })}
        />
        <label>Side B — crew</label>
        <input
          type="text"
          value={names.cb}
          onChange={(e) => setNames({ ...names, cb: e.target.value })}
        />
        <label>Side B — photo</label>
        <div className="drop" onClick={() => fileB.current?.click()}>
          Choose image
        </div>
        <input
          ref={fileB}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pick('b', e.target.files?.[0])}
        />

        <h2 style={{ marginTop: '26px' }}>Look</h2>
        <div className="row">
          <span>Bloom</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={fx.bloom}
            onChange={(e) => setFx({ ...fx, bloom: parseFloat(e.target.value) })}
          />
        </div>
        <button
          className={'ghost' + (fx.aberration ? ' on' : '')}
          onClick={() => setFx({ ...fx, aberration: !fx.aberration })}
        >
          Chromatic aberration: {fx.aberration ? 'on' : 'off'}
        </button>
        <button
          className={'ghost' + (fx.grain ? ' on' : '')}
          onClick={() => setFx({ ...fx, grain: !fx.grain })}
        >
          Film grain: {fx.grain ? 'on' : 'off'}
        </button>

        <button
          onClick={() => {
            setOpen(false);
            play();
          }}
        >
          Play reveal
        </button>
        <button className="ghost" onClick={() => document.documentElement.requestFullscreen?.()}>
          Fullscreen (projector)
        </button>
      </aside>

      {error && <div className="err">{error}</div>}
    </div>
  );
}
