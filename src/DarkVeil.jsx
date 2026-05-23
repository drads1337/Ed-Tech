import { useEffect, useRef, useState } from 'react';
import { Mesh, Program, Renderer, Triangle, Vec2 } from 'ogl';

import './DarkVeil.css';

const vertex = `
attribute vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}
`;

const fragment = `
#ifdef GL_ES
precision highp float;
#endif
uniform vec2 uResolution;
uniform float uTime;
uniform float uWarp;
uniform float uGrain;
uniform vec3 uBaseColor;
uniform vec3 uAccentColor;
uniform vec3 uLiftColor;
uniform vec3 uDepthColor;

float hash(vec2 p){
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);
}

float noise(vec2 p){
    vec2 i=floor(p);
    vec2 f=fract(p);
    vec2 u=f*f*(3.0-2.0*f);
    return mix(
        mix(hash(i+vec2(0.0,0.0)),hash(i+vec2(1.0,0.0)),u.x),
        mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),
        u.y
    );
}

float softBlob(vec2 uv,vec2 center,float radius,float feather){
    float distanceToCenter=length(uv-center);
    return 1.0-smoothstep(radius,radius+feather,distanceToCenter);
}

float auroraBand(vec2 uv,float offset,float width,float phase,float bend){
    float wave=sin((uv.x+phase)*2.4)*0.08+sin((uv.x*2.7-phase)*1.8)*0.035;
    float ribbon=uv.y-offset-wave-bend*uv.x*uv.x;
    float core=1.0-smoothstep(0.0,width,abs(ribbon));
    float halo=1.0-smoothstep(width,width*5.8,abs(ribbon));
    return core*0.6+halo*0.28;
}

void main(){
    vec2 uv=gl_FragCoord.xy/uResolution.xy;
    vec2 centered=(uv-0.5)*vec2(uResolution.x/uResolution.y,1.0);
    float drift=uTime*0.035;
    float organic=noise(centered*2.2+vec2(drift,-drift))*2.0-1.0;
    centered+=uWarp*0.035*organic;

    float upperGlow=softBlob(centered,vec2(-0.32,0.2+0.03*sin(drift*2.0)),0.16,0.72);
    float sideGlow=softBlob(centered,vec2(0.44,-0.08+0.04*cos(drift*1.7)),0.12,0.58);
    float floorGlow=softBlob(centered,vec2(0.02,-0.48),0.26,0.64);
    float vignette=smoothstep(1.02,0.08,length(centered*vec2(0.88,1.18)));
    float vertical=1.0-smoothstep(-0.18,0.72,uv.y);
    float skyMask=smoothstep(-0.5,0.22,centered.y)*(1.0-smoothstep(0.68,1.08,length(centered)));
    float quietCenter=1.0-smoothstep(0.08,0.46,length(centered-vec2(0.02,-0.08)));
    float bandNoise=0.72+0.28*noise(centered*4.8+vec2(drift*2.0,drift));
    float bands=auroraBand(centered,0.2,0.018,drift,0.08);
    bands+=auroraBand(centered,0.32,0.012,-drift*1.4,0.12)*0.76;
    bands+=auroraBand(centered,0.08,0.022,drift*0.7,-0.04)*0.54;
    bands*=skyMask*(1.0-quietCenter*0.64)*bandNoise;

    vec3 color=mix(uDepthColor,uBaseColor,0.78+0.22*vertical);
    color=mix(color,uAccentColor,upperGlow*0.28+sideGlow*0.2);
    color=mix(color,uAccentColor,bands*0.34);
    color=mix(color,uLiftColor,bands*0.2);
    color=mix(color,uLiftColor,floorGlow*0.34+vignette*0.24);
    color*=0.9+0.1*vignette;
    color+=(noise(gl_FragCoord.xy*0.72+uTime)-0.5)*uGrain;

    gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
}
`;

const DEFAULT_BASE_COLOR = [0.84, 0.81, 0.75];
const DEFAULT_ACCENT_COLOR = [0.65, 0.7, 0.66];
const DEFAULT_LIFT_COLOR = [0.96, 0.93, 0.88];
const DEFAULT_DEPTH_COLOR = [0.5, 0.46, 0.4];

export default function DarkVeil({
  baseColor = DEFAULT_BASE_COLOR,
  accentColor = DEFAULT_ACCENT_COLOR,
  liftColor = DEFAULT_LIFT_COLOR,
  depthColor = DEFAULT_DEPTH_COLOR,
  noiseIntensity = 0.018,
  scanlineIntensity = 0,
  speed = 0.5,
  scanlineFrequency = 0,
  warpAmount = 0.08,
  resolutionScale = 1,
}) {
  const ref = useRef(null);
  const [hasWebGlFallback, setHasWebGlFallback] = useState(false);

  useEffect(() => {
    if (!ref.current?.parentElement) {
      return undefined;
    }

    const canvas = ref.current;
    const parent = canvas.parentElement;
    const testCanvas = document.createElement('canvas');

    if (!testCanvas.getContext('webgl') && !testCanvas.getContext('experimental-webgl')) {
      setHasWebGlFallback(true);
      return undefined;
    }

    let renderer;

    try {
      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 2),
        canvas,
      });
    } catch {
      setHasWebGlFallback(true);
      return undefined;
    }

    setHasWebGlFallback(false);
    const gl = renderer.gl;
    const geometry = new Triangle(gl);
    let program;

    try {
      program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new Vec2() },
          uGrain: { value: noiseIntensity },
          uWarp: { value: warpAmount },
          uBaseColor: { value: baseColor },
          uAccentColor: { value: accentColor },
          uLiftColor: { value: liftColor },
          uDepthColor: { value: depthColor },
        },
      });
    } catch {
      setHasWebGlFallback(true);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return undefined;
    }

    if (!program.uniformLocations || !program.attributeLocations) {
      setHasWebGlFallback(true);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return undefined;
    }

    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      const width = parent.clientWidth;
      const height = parent.clientHeight;

      renderer.setSize(width * resolutionScale, height * resolutionScale);
      program.uniforms.uResolution.value.set(width, height);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    window.addEventListener('resize', resize);
    resize();

    const start = performance.now();
    let frame = 0;

    function loop() {
      program.uniforms.uTime.value = ((performance.now() - start) / 1000) * speed;
      program.uniforms.uGrain.value = noiseIntensity;
      program.uniforms.uWarp.value = warpAmount;
      program.uniforms.uBaseColor.value = baseColor;
      program.uniforms.uAccentColor.value = accentColor;
      program.uniforms.uLiftColor.value = liftColor;
      program.uniforms.uDepthColor.value = depthColor;
      renderer.render({ scene: mesh });
      frame = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    accentColor,
    baseColor,
    depthColor,
    liftColor,
    noiseIntensity,
    resolutionScale,
    scanlineFrequency,
    scanlineIntensity,
    speed,
    warpAmount,
  ]);

  if (hasWebGlFallback) {
    return <div className="darkveil-fallback" />;
  }

  return <canvas ref={ref} className="darkveil-canvas" />;
}
