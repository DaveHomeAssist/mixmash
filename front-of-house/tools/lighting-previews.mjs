// Render menu previews from the runtime lighting adapter. Run from the repository root on a browser runner.
import { chromium } from 'playwright';
import { startStaticServer, launchOptions } from '../../test/static-server.mjs';
import { mkdir } from 'node:fs/promises';
const server = await startStaticServer();
const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({viewport:{width:640,height:400},deviceScaleFactor:1});
await page.goto(server.origin+'/front-of-house/');
await page.evaluate(async () => {
  const T = await import('./vendor/three/three.module.min.js');
  const {createLotModels} = await import('./lot-models.mjs');
  document.documentElement.style.background='transparent'; document.body.innerHTML=''; document.body.style.cssText='margin:0;background:transparent;';
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(640,400);renderer.setClearColor(0,0);renderer.setPixelRatio(1);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;
  document.body.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,640/400,.01,20);
  camera.position.set(.8,2.9,1.5);camera.lookAt(0,2.66,0);
  scene.add(new T.HemisphereLight(0xffffff,0x77786a,3));
  const key=new T.DirectionalLight(0xfff3d8,4);key.position.set(-2,4,4);scene.add(key);
  const rim=new T.DirectionalLight(0xb9d9ee,2);rim.position.set(3,2,-2);scene.add(rim);
  const models=createLotModels();let rig;
  window.renderLighting=(type)=>{if(rig)scene.remove(rig);rig=models.create({type,x:0,y:0,rot:0});rig.position.set(0,0,0);scene.add(rig);renderer.render(scene,camera);};
});
await mkdir('front-of-house/assets/equipment',{recursive:true});
for(const type of ['lights']){await page.evaluate(type=>renderLighting(type),type);await page.locator('canvas').screenshot({path:`front-of-house/assets/equipment/${type}.png`,omitBackground:true});}
await browser.close();await server.close();
