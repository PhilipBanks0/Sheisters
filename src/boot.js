// SHEISTERS — loads three.js as a module (so the glTF loader can share it), then the game.
import * as THREE from 'three';
window.THREE = THREE;
import('./main.js');
