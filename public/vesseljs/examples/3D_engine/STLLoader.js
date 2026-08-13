/**
 * STLLoader stub for Three.js r126 compatibility.
 * PX121 ship spec uses JSON hull geometry, not STL files.
 * This stub provides the STLLoader class interface so Ship3D.js can import it without errors.
 */

import * as THREE from "./three_r126.js";

class STLLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
  }

  load(url, onLoad, onProgress, onError) {
    const loader = new THREE.FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType('arraybuffer');
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(url, (data) => {
      try {
        if (onLoad) onLoad(this.parse(data));
      } catch (e) {
        if (onError) onError(e);
        else console.error(e);
        this.manager.itemError(url);
      }
    }, onProgress, onError);
  }

  parse(data) {
    const geometry = new THREE.BufferGeometry();
    if (typeof data === 'string') {
      // ASCII STL - minimal parser
      const vertices = [];
      const normals = [];
      const lines = data.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('facet normal')) {
          const parts = line.split(/\s+/);
          const nx = parseFloat(parts[2]), ny = parseFloat(parts[3]), nz = parseFloat(parts[4]);
          normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
        } else if (line.startsWith('vertex')) {
          const parts = line.split(/\s+/);
          vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
        }
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      // Binary STL
      const reader = new DataView(data);
      const faces = reader.getUint32(80, true);
      const vertices = new Float32Array(faces * 9);
      const normals = new Float32Array(faces * 9);
      let offset = 84;
      for (let face = 0; face < faces; face++) {
        const nx = reader.getFloat32(offset, true); offset += 4;
        const ny = reader.getFloat32(offset, true); offset += 4;
        const nz = reader.getFloat32(offset, true); offset += 4;
        for (let v = 0; v < 3; v++) {
          const idx = face * 9 + v * 3;
          vertices[idx] = reader.getFloat32(offset, true); offset += 4;
          vertices[idx + 1] = reader.getFloat32(offset, true); offset += 4;
          vertices[idx + 2] = reader.getFloat32(offset, true); offset += 4;
          normals[idx] = nx; normals[idx + 1] = ny; normals[idx + 2] = nz;
        }
        offset += 2; // attribute byte count
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    }
    return geometry;
  }
}

export { STLLoader };
