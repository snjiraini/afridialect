const root = document.documentElement;
const toggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("wa-theme");
if (savedTheme === "dark") {
  root.setAttribute("data-theme","dark");
}

gsap.from(".sidebar", {
  opacity:0,
  x:-20,
  duration:1,
  ease:"power3.out"
});

gsap.from(".topbar", {
  opacity:0,
  y:-20,
  duration:1,
  ease:"power3.out",
  delay:.1
});

gsap.from(".item", {
  opacity:0,
  y:14,
  stagger:.04,
  duration:.6,
  ease:"power2.out"
});

toggle.addEventListener("click", () => {
  const isDark = root.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  if (next === "dark") {
    root.setAttribute("data-theme","dark");
  } else {
    root.removeAttribute("data-theme");
  }
  localStorage.setItem("wa-theme", next);
  gsap.fromTo(".main",{scale:0.99,opacity:0.9},{scale:1,opacity:1,duration:.45,ease:"power2.out"});
  uniforms.u_theme.value = next === "dark" ? 1 : 0;
});

const canvas = document.getElementById("bg");
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const uniforms = {
  u_time: { value: 0 },
  u_res: { value: new THREE.Vector2(1,1) },
  u_theme: { value: root.getAttribute("data-theme") === "dark" ? 1 : 0 }
};

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: `void main(){gl_Position=vec4(position,1.0);}`,
  fragmentShader: `
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_theme;
    float wave(vec2 p, float t){
      return sin((p.x+p.y+t)*2.4)+sin((p.x*1.7-p.y*1.3-t)*3.2);
    }
    void main(){
      vec2 st = gl_FragCoord.xy/u_res;
      vec2 p = st*2.0-1.0;
      float t = u_time*0.06;
      float v = wave(p,t)*0.12+0.52;
      vec3 l1 = vec3(0.07,0.58,0.51);
      vec3 l2 = vec3(0.90,0.98,0.96);
      vec3 d1 = vec3(0.02,0.08,0.09);
      vec3 d2 = vec3(0.08,0.17,0.20);
      vec3 c1 = mix(l1,d1,u_theme);
      vec3 c2 = mix(l2,d2,u_theme);
      vec3 col = mix(c1,c2,v);
      gl_FragColor = vec4(col,1.0);
    }
  `
});

const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material);
scene.add(mesh);

function resize(){
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w,h);
  uniforms.u_res.value.set(w,h);
}
resize();
window.addEventListener("resize", resize);

function animate(t){
  uniforms.u_time.value = t*0.001;
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
