(function(){
const canvas=document.getElementById("cx3d-canvas");if(!canvas)return;
if(!window.THREE){const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";s.onload=initScene;document.head.appendChild(s)}else initScene();
function initScene(){
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x0a0f1a,0.04);
const camera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,0.1,100);
camera.position.set(0,2.5,6);camera.lookAt(0,1,0);
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x0a0f1a,1);
scene.add(new THREE.AmbientLight(0x2f6bff,0.35));
const dir=new THREE.DirectionalLight(0xffb000,0.6);dir.position.set(4,8,4);scene.add(dir);
const grid=new THREE.GridHelper(30,30,0x1d2942,0x131b2e);scene.add(grid);
const plane=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:0x0a0f1a,roughness:0.8,metalness:0.2}));
plane.rotation.x=-Math.PI/2;plane.position.y=-0.01;scene.add(plane);
const beamMat=new THREE.MeshStandardMaterial({color:0x1d2942,roughness:0.4,metalness:0.8});
for(let i=0;i<3;i++)for(let j=0;j<2;j++){const h=3+Math.random();const col=new THREE.Mesh(new THREE.BoxGeometry(0.12,h,0.12),beamMat);col.position.set((i-1)*3,h/2,(j-0.5)*3);scene.add(col)}
const craneGroup=new THREE.Group();const amberMat=new THREE.MeshStandardMaterial({color:0xffb000,roughness:0.3,metalness:0.9,emissive:0xffb000,emissiveIntensity:0.12});
const tower=new THREE.Mesh(new THREE.BoxGeometry(0.25,6,0.25),amberMat);tower.position.y=3;craneGroup.add(tower);
const jib=new THREE.Mesh(new THREE.BoxGeometry(4,0.1,0.1),amberMat);jib.position.set(1.8,5.8,0);craneGroup.add(jib);
craneGroup.position.set(-1.5,0,-3);scene.add(craneGroup);
const pCount=200;const pGeo=new THREE.BufferGeometry();const pos=new Float32Array(pCount*3);
for(let i=0;i<pCount;i++){pos[i*3]=(Math.random()-0.5)*16;pos[i*3+1]=Math.random()*6;pos[i*3+2]=(Math.random()-0.5)*16}
pGeo.setAttribute("position",new THREE.BufferAttribute(pos,3));
const pMat=new THREE.PointsMaterial({color:0xffb000,size:0.035,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending});
scene.add(new THREE.Points(pGeo,pMat));
let time=0;const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const d=clock.getDelta();time+=d;camera.position.x=Math.sin(time*0.06)*6;camera.position.z=Math.cos(time*0.06)*6;camera.lookAt(0,1.5,0);craneGroup.rotation.y=Math.sin(time*0.12)*0.25;renderer.render(scene,camera)}
animate();
window.addEventListener("resize",()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight)});
}
})();
