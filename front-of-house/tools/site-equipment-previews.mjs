// Render the remaining menu previews from the exact venue models, without modifying geometry.
import { chromium } from 'playwright';
import { startStaticServer, launchOptions } from '../../test/static-server.mjs';
import { mkdir } from 'node:fs/promises';
import { SITE_CARD_TYPES } from '../equipment-cards.mjs';
const server = await startStaticServer(), browser = await chromium.launch(launchOptions());
try {
  const page = await browser.newPage({viewport:{width:640,height:400},deviceScaleFactor:1});
  await page.goto(server.origin+'/front-of-house/');
  await page.evaluate(async () => {
    const T=await import('./vendor/three/three.module.min.js'), {createLotModels}=await import('./lot-models.mjs');
    document.documentElement.style.background='transparent';document.body.innerHTML='';document.body.style.cssText='margin:0;background:transparent';
    const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(640,400);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;document.body.append(renderer.domElement);
    const scene=new T.Scene(), camera=new T.PerspectiveCamera(32,1.6,.01,100);
    scene.add(new T.HemisphereLight(0xffffff,0x77786a,3));
    const key=new T.DirectionalLight(0xfff3d8,4);key.position.set(-2,4,4);scene.add(key);
    const rim=new T.DirectionalLight(0xb9d9ee,2);rim.position.set(3,2,-2);scene.add(rim);
    const models=createLotModels();let model;
    window.renderSiteEquipment=type=>{
      if(model)scene.remove(model);model=models.create({type,x:0,y:0,rot:0});scene.add(model);
      const box=new T.Box3().setFromObject(model),centre=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
      const radius=size.length()/2,distance=radius/Math.sin(T.MathUtils.degToRad(16))*1.04;
      camera.zoom=1;camera.position.copy(centre).add(new T.Vector3(1,.8,1.5).normalize().multiplyScalar(distance));camera.lookAt(centre);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
      let extent=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new T.Vector3(x,y,z).project(camera);extent=Math.max(extent,Math.abs(p.x),Math.abs(p.y));}
      camera.zoom=.88/extent;camera.updateProjectionMatrix();renderer.render(scene,camera);
    };
  });
  await mkdir('front-of-house/assets/equipment',{recursive:true});
  for(const type of SITE_CARD_TYPES){await page.evaluate(type=>renderSiteEquipment(type),type);await page.locator('canvas').screenshot({path:`front-of-house/assets/equipment/${type}.png`,omitBackground:true});}
} finally {await browser.close();await server.close();}
