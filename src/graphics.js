// ฉาก 3D ของกระดานหมากรุก (three.js): แสงเงา วัสดุสะท้อนแสง กล้องหมุนอิสระ
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fileOf, rankOf, squareIndex, WHITE } from './engine.js';

const SQ = 1;
const BOARD_TOP = 0.06;

const MARBLE_VARIANTS = [
    { color: 0xfffefa, roughness: 0.27, repeat: 1.05, rotation: 0.00, offset: [0.00, 0.00] },
    { color: 0xf8f6f1, roughness: 0.31, repeat: 1.18, rotation: Math.PI * 0.50, offset: [0.19, 0.08] },
    { color: 0xfdf9f2, roughness: 0.25, repeat: 1.12, rotation: Math.PI, offset: [0.07, 0.22] },
    { color: 0xf4f6f7, roughness: 0.30, repeat: 1.24, rotation: Math.PI * 1.50, offset: [0.24, 0.15] }
];

const V2 = (x, y) => new THREE.Vector2(x, y);

const PROFILES = {
    p: [V2(0, 0), V2(0.26, 0), V2(0.26, 0.04), V2(0.24, 0.075), V2(0.20, 0.12), V2(0.185, 0.17),
    V2(0.19, 0.20), V2(0.155, 0.23), V2(0.128, 0.28), V2(0.115, 0.36), V2(0.112, 0.43),
    V2(0.13, 0.465), V2(0.178, 0.495), V2(0.19, 0.525), V2(0.155, 0.55), V2(0.12, 0.575),
    V2(0.152, 0.615), V2(0.168, 0.675), V2(0.152, 0.735), V2(0.112, 0.785), V2(0.06, 0.82), V2(0, 0.83)],

    r: [V2(0, 0), V2(0.30, 0), V2(0.30, 0.05), V2(0.275, 0.09), V2(0.225, 0.145), V2(0.205, 0.20),
    V2(0.20, 0.30), V2(0.205, 0.46), V2(0.225, 0.545), V2(0.265, 0.60), V2(0.275, 0.645),
    V2(0.285, 0.66), V2(0.285, 0.80), V2(0.225, 0.80), V2(0.225, 0.72), V2(0, 0.72)],

    b: [V2(0, 0), V2(0.285, 0), V2(0.285, 0.05), V2(0.26, 0.09), V2(0.21, 0.145), V2(0.185, 0.20),
    V2(0.155, 0.26), V2(0.118, 0.37), V2(0.105, 0.47), V2(0.135, 0.525), V2(0.192, 0.555),
    V2(0.205, 0.59), V2(0.165, 0.63), V2(0.132, 0.665), V2(0.178, 0.715), V2(0.202, 0.79),
    V2(0.188, 0.875), V2(0.145, 0.955), V2(0.075, 1.015), V2(0.03, 1.03), V2(0, 1.025)],

    q: [V2(0, 0), V2(0.31, 0), V2(0.31, 0.05), V2(0.285, 0.10), V2(0.235, 0.155), V2(0.205, 0.215),
    V2(0.168, 0.34), V2(0.135, 0.50), V2(0.118, 0.615), V2(0.152, 0.665), V2(0.222, 0.705),
    V2(0.238, 0.745), V2(0.192, 0.79), V2(0.162, 0.835), V2(0.205, 0.905), V2(0.268, 1.035),
    V2(0.272, 1.12), V2(0.212, 1.12), V2(0.212, 1.055), V2(0, 1.015)],

    k: [V2(0, 0), V2(0.325, 0), V2(0.325, 0.05), V2(0.30, 0.10), V2(0.245, 0.16), V2(0.215, 0.225),
    V2(0.175, 0.36), V2(0.138, 0.54), V2(0.122, 0.665), V2(0.16, 0.715), V2(0.232, 0.755),
    V2(0.248, 0.795), V2(0.202, 0.84), V2(0.172, 0.885), V2(0.215, 0.965), V2(0.278, 1.10),
    V2(0.282, 1.185), V2(0.218, 1.185), V2(0.218, 1.115), V2(0, 1.075)],

    nBase: [V2(0, 0), V2(0.295, 0), V2(0.295, 0.05), V2(0.268, 0.09), V2(0.218, 0.145),
    V2(0.196, 0.20), V2(0.188, 0.25), V2(0.196, 0.285), V2(0.17, 0.30), V2(0, 0.30)]
};

function latheGeometry(points, segments = 56) {
    const g = new THREE.LatheGeometry(points, segments);
    g.computeVertexNormals();
    return g;
}

function knightHeadGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-0.20, 0.20);
    s.bezierCurveTo(-0.30, 0.50, -0.29, 0.78, -0.13, 0.94);
    s.lineTo(-0.09, 1.10);
    s.lineTo(0.00, 0.99);
    s.lineTo(0.09, 1.08);
    s.lineTo(0.155, 0.925);
    s.bezierCurveTo(0.30, 0.90, 0.395, 0.80, 0.36, 0.675);
    s.lineTo(0.215, 0.615);
    s.bezierCurveTo(0.155, 0.545, 0.135, 0.44, 0.175, 0.33);
    s.lineTo(0.20, 0.20);
    s.closePath();

    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.26, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4, curveSegments: 24
    });
    g.translate(0, 0, -0.165);
    return g;
}

function buildPieceGeometry(type) {
    const parts = [];
    if (type === 'n') {
        parts.push(latheGeometry(PROFILES.nBase));
        parts.push(knightHeadGeometry());
    } else if (type === 'r') {
        parts.push(latheGeometry(PROFILES.r));
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const box = new THREE.BoxGeometry(0.10, 0.13, 0.11);
            box.rotateY(-a);
            box.translate(Math.cos(a) * 0.253, 0.845, Math.sin(a) * 0.253);
            parts.push(box);
        }
    } else if (type === 'q') {
        parts.push(latheGeometry(PROFILES.q));
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const ball = new THREE.SphereGeometry(0.048, 18, 14);
            ball.translate(Math.cos(a) * 0.245, 1.15, Math.sin(a) * 0.245);
            parts.push(ball);
        }
        const top = new THREE.SphereGeometry(0.072, 22, 16);
        top.translate(0, 1.19, 0);
        parts.push(top);
    } else if (type === 'k') {
        parts.push(latheGeometry(PROFILES.k));
        const v = new THREE.BoxGeometry(0.075, 0.30, 0.075);
        v.translate(0, 1.30, 0);
        const h = new THREE.BoxGeometry(0.21, 0.072, 0.072);
        h.translate(0, 1.345, 0);
        parts.push(v, h);
    } else if (type === 'b') {
        parts.push(latheGeometry(PROFILES.b));
        const ball = new THREE.SphereGeometry(0.055, 20, 14);
        ball.translate(0, 1.075, 0);
        parts.push(ball);
    } else {
        parts.push(latheGeometry(PROFILES.p));
    }
    const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    merged.computeVertexNormals();
    return merged;
}

function makeLabelTexture(text) {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#c8b89a';
    ctx.font = 'bold 74px "Noto Sans Thai", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + 4);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

export class Board3D {
    constructor(container) {
        this.container = container;
        this.pieceMeshes = new Map();   // square -> Mesh
        this.tweens = [];
        this.orientation = WHITE;
        this.onPick = null;
        this.geoCache = {};
        this.animating = false;
        this.marbleVariantByPiece = new WeakMap();
        this.nextMarbleVariant = 0;

        this._initRenderer();
        this._initScene();
        this._initLights();
        this._buildTable();
        this._buildBoard();
        this._buildMarkers();
        this._initInteraction();

        this.clock = new THREE.Clock();
        this._loop = this._loop.bind(this);
        this.renderer.setAnimationLoop(this._loop);
        window.addEventListener('resize', () => this.resize());
    }

    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.92;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);
    }

    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0c10);
        this.scene.fog = new THREE.Fog(0x0a0c10, 22, 46);

        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environment = this.envMap;
        pmrem.dispose();

        const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
        this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 200);
        this.camera.position.set(0, 10.4, 12.2);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.07;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 28;
        this.controls.maxPolarAngle = Math.PI * 0.49;
        this.controls.update();
    }

    _initLights() {
        const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x20222a, 0.4);
        this.scene.add(hemi);

        const key = new THREE.DirectionalLight(0xfff2dd, 2.0);
        key.position.set(6, 12, 7);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.near = 1;
        key.shadow.camera.far = 40;
        const d = 8;
        key.shadow.camera.left = -d;
        key.shadow.camera.right = d;
        key.shadow.camera.top = d;
        key.shadow.camera.bottom = -d;
        key.shadow.bias = -0.0006;
        key.shadow.normalBias = 0.02;
        this.scene.add(key);
        this.keyLight = key;

        const rim = new THREE.DirectionalLight(0x88aaff, 0.9);
        rim.position.set(-8, 6, -7);
        this.scene.add(rim);

        const fill = new THREE.PointLight(0xffd9a0, 18, 24, 2);
        fill.position.set(-4, 5, 5);
        this.scene.add(fill);
    }

    _buildTable() {
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(26, 64),
            new THREE.MeshPhysicalMaterial({ color: 0x0d1016, roughness: 0.22, metalness: 0.55, envMapIntensity: 0.8 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.46;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    _buildBoard() {
        const group = new THREE.Group();

        const frameMat = new THREE.MeshPhysicalMaterial({
            color: 0x2b1a10, roughness: 0.35, metalness: 0.15, clearcoat: 0.85, clearcoatRoughness: 0.18, envMapIntensity: 0.9
        });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.44, 9.4), frameMat);
        frame.position.y = -0.22 + BOARD_TOP - 0.06;
        frame.castShadow = true;
        frame.receiveShadow = true;
        group.add(frame);

        const lightMat = new THREE.MeshPhysicalMaterial({
            color: 0x9a7048, roughness: 0.42, metalness: 0.0, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.5
        });
        const darkMat = new THREE.MeshPhysicalMaterial({
            color: 0x38200f, roughness: 0.45, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.32, envMapIntensity: 0.5
        });

        const squareGeo = new THREE.BoxGeometry(SQ, 0.06, SQ);
        this.squareMeshes = [];
        for (let i = 0; i < 64; i++) {
            const isLight = (fileOf(i) + rankOf(i)) % 2 === 1;
            const mesh = new THREE.Mesh(squareGeo, isLight ? lightMat : darkMat);
            const p = this.squareToWorld(i);
            mesh.position.set(p.x, BOARD_TOP - 0.03, p.z);
            mesh.receiveShadow = true;
            mesh.userData.square = i;
            group.add(mesh);
            this.squareMeshes.push(mesh);
        }

        // ตัวอักษรกำกับแถวและคอลัมน์
        const labels = new THREE.Group();
        for (let f = 0; f < 8; f++) {
            const t = makeLabelTexture('abcdefgh'[f]);
            for (const side of [1, -1]) {
                const m = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.42, 0.42),
                    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })
                );
                m.rotation.x = -Math.PI / 2;
                m.position.set((f - 3.5) * SQ, BOARD_TOP + 0.005, side * 4.32);
                labels.add(m);
            }
        }
        for (let r = 0; r < 8; r++) {
            const t = makeLabelTexture(String(r + 1));
            for (const side of [1, -1]) {
                const m = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.42, 0.42),
                    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })
                );
                m.rotation.x = -Math.PI / 2;
                m.position.set(side * 4.32, BOARD_TOP + 0.005, -(r - 3.5) * SQ);
                labels.add(m);
            }
        }
        group.add(labels);

        this.boardGroup = group;
        this.scene.add(group);
    }

    _buildMarkers() {
        this.markers = new THREE.Group();
        this.scene.add(this.markers);

        this.marbleMaterials = MARBLE_VARIANTS.map((variant) => new THREE.MeshPhysicalMaterial({
            color: variant.color,
            roughness: variant.roughness,
            metalness: 0.0,
            clearcoat: 0.72,
            clearcoatRoughness: 0.18,
            envMapIntensity: 1.15
        }));

        this.materials = {
            w: this.marbleMaterials[0],
            b: new THREE.MeshPhysicalMaterial({
                color: 0x0e0f13, roughness: 0.22, metalness: 0.12, clearcoat: 0.95, clearcoatRoughness: 0.08,
                envMapIntensity: 0.85
            })
        };

        const marbleUrl = new URL('../assets/textures/white-carrara-marble.png', import.meta.url);
        new THREE.TextureLoader().load(
            marbleUrl.href,
            (source) => {
                const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
                source.colorSpace = THREE.SRGBColorSpace;

                this.marbleMaterials.forEach((material, index) => {
                    const variant = MARBLE_VARIANTS[index];
                    const texture = index === 0 ? source : source.clone();
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.setScalar(variant.repeat);
                    texture.center.set(0.5, 0.5);
                    texture.rotation = variant.rotation;
                    texture.offset.set(...variant.offset);
                    texture.anisotropy = Math.min(8, maxAnisotropy);
                    texture.needsUpdate = true;
                    material.map = texture;
                    material.needsUpdate = true;
                });
            },
            undefined,
            (error) => console.warn('Unable to load the white marble texture.', error)
        );

        this.selectMat = new THREE.MeshBasicMaterial({ color: 0x54d4ff, transparent: true, opacity: 0.62, depthWrite: false });
        this.moveMat = new THREE.MeshBasicMaterial({ color: 0x5ff77f, transparent: true, opacity: 0.8, depthWrite: false });
        this.captureMat = new THREE.MeshBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.8, depthWrite: false });
        this.lastMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.42, depthWrite: false });
        this.checkMat = new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.62, depthWrite: false });
        this.hintMat = new THREE.MeshBasicMaterial({ color: 0xc39bff, transparent: true, opacity: 0.75, depthWrite: false });

        this.dotGeo = new THREE.CircleGeometry(0.17, 32);
        this.ringGeo = new THREE.RingGeometry(0.35, 0.46, 40);
        this.tileGeo = new THREE.PlaneGeometry(SQ * 0.94, SQ * 0.94);
    }

    _initInteraction() {
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        const el = this.renderer.domElement;
        let downPos = null;
        el.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
        el.addEventListener('pointerup', (e) => {
            if (!downPos) return;
            const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
            downPos = null;
            if (moved > 6 || !this.onPick) return;
            const sq = this._pickSquare(e);
            if (sq >= 0) this.onPick(sq);
        });
    }

    _pickSquare(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const targets = [...this.squareMeshes, ...this.pieceMeshes.values()];
        const hits = this.raycaster.intersectObjects(targets, false);
        for (const h of hits) {
            const s = h.object.userData.square;
            if (typeof s === 'number') return s;
        }
        return -1;
    }

    squareToWorld(i) {
        return { x: (fileOf(i) - 3.5) * SQ, z: -(rankOf(i) - 3.5) * SQ };
    }

    _geometry(type) {
        if (!this.geoCache[type]) this.geoCache[type] = buildPieceGeometry(type);
        return this.geoCache[type];
    }

    _materialForPiece(piece) {
        if (piece.color !== WHITE) return this.materials.b;

        if (!this.marbleVariantByPiece.has(piece)) {
            this.marbleVariantByPiece.set(piece, this.nextMarbleVariant);
            this.nextMarbleVariant = (this.nextMarbleVariant + 1) % this.marbleMaterials.length;
        }
        return this.marbleMaterials[this.marbleVariantByPiece.get(piece)];
    }

    _createPiece(piece, square) {
        const mesh = new THREE.Mesh(this._geometry(piece.type), this._materialForPiece(piece));
        const p = this.squareToWorld(square);
        mesh.position.set(p.x, BOARD_TOP, p.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.square = square;
        mesh.userData.piece = piece.type;
        mesh.userData.color = piece.color;
        if (piece.type === 'n') mesh.rotation.y = piece.color === WHITE ? Math.PI / 2 : -Math.PI / 2;
        else mesh.rotation.y = Math.random() * Math.PI * 2;
        this.scene.add(mesh);
        this.pieceMeshes.set(square, mesh);
        return mesh;
    }

    /** วางหมากใหม่ทั้งกระดานตามสถานะปัจจุบัน */
    syncBoard(board) {
        for (const mesh of this.pieceMeshes.values()) this.scene.remove(mesh);
        this.pieceMeshes.clear();
        for (let i = 0; i < 64; i++) {
            if (board[i]) this._createPiece(board[i], i);
        }
    }

    animateMove(move, boardAfter, onDone) {
        const mesh = this.pieceMeshes.get(move.from);
        if (!mesh) { this.syncBoard(boardAfter); onDone && onDone(); return; }
        this.animating = true;

        const capSq = move.flag === 'ep'
            ? squareIndex(fileOf(move.to), rankOf(move.from))
            : (this.pieceMeshes.has(move.to) ? move.to : -1);

        if (capSq >= 0) {
            const cap = this.pieceMeshes.get(capSq);
            if (cap) {
                this.pieceMeshes.delete(capSq);
                this._tween({
                    duration: 0.35,
                    update: (t) => {
                        cap.position.y = BOARD_TOP + t * 0.5;
                        cap.scale.setScalar(Math.max(0.001, 1 - t));
                        cap.rotation.z = t * 0.8;
                    },
                    done: () => this.scene.remove(cap)
                });
            }
        }

        this.pieceMeshes.delete(move.from);
        const from = this.squareToWorld(move.from);
        const to = this.squareToWorld(move.to);
        const lift = move.piece === 'n' ? 1.15 : 0.55;
        const duration = move.piece === 'n' ? 0.55 : 0.45;

        this._tween({
            duration,
            update: (t) => {
                const e = t * t * (3 - 2 * t);
                mesh.position.x = from.x + (to.x - from.x) * e;
                mesh.position.z = from.z + (to.z - from.z) * e;
                mesh.position.y = BOARD_TOP + Math.sin(Math.PI * t) * lift;
            },
            done: () => {
                mesh.position.set(to.x, BOARD_TOP, to.z);
                mesh.userData.square = move.to;
                this.pieceMeshes.set(move.to, mesh);
                if (move.flag === 'castleK' || move.flag === 'castleQ') {
                    const rookFrom = move.flag === 'castleK' ? move.from + 3 : move.from - 4;
                    const rookTo = move.flag === 'castleK' ? move.from + 1 : move.from - 1;
                    const rook = this.pieceMeshes.get(rookFrom);
                    if (rook) {
                        this.pieceMeshes.delete(rookFrom);
                        const rf = this.squareToWorld(rookFrom);
                        const rt = this.squareToWorld(rookTo);
                        this._tween({
                            duration: 0.3,
                            update: (t2) => {
                                const e2 = t2 * t2 * (3 - 2 * t2);
                                rook.position.x = rf.x + (rt.x - rf.x) * e2;
                                rook.position.z = rf.z + (rt.z - rf.z) * e2;
                            },
                            done: () => {
                                this.syncBoard(boardAfter);
                                this.animating = false;
                                onDone && onDone();
                            }
                        });
                        return;
                    }
                }
                this.syncBoard(boardAfter);
                this.animating = false;
                onDone && onDone();
            }
        });
    }

    _tween(t) {
        this.tweens.push({ ...t, elapsed: 0 });
    }

    _flatMesh(geo, mat, square, y = BOARD_TOP + 0.012) {
        const m = new THREE.Mesh(geo, mat);
        const p = this.squareToWorld(square);
        m.rotation.x = -Math.PI / 2;
        m.position.set(p.x, y, p.z);
        this.markers.add(m);
        return m;
    }

    /** อัปเดตไฮไลต์ทั้งหมด */
    setHighlights({ selected = -1, moves = [], captures = [], last = null, check = -1, hint = null } = {}) {
        this.markers.clear();
        if (last) {
            this._flatMesh(this.tileGeo, this.lastMat, last.from, BOARD_TOP + 0.008);
            this._flatMesh(this.tileGeo, this.lastMat, last.to, BOARD_TOP + 0.008);
        }
        if (check >= 0) this._flatMesh(this.tileGeo, this.checkMat, check, BOARD_TOP + 0.009);
        if (selected >= 0) this._flatMesh(this.tileGeo, this.selectMat, selected, BOARD_TOP + 0.01);
        for (const s of moves) this._flatMesh(this.dotGeo, this.moveMat, s);
        for (const s of captures) this._flatMesh(this.ringGeo, this.captureMat, s);
        if (hint) {
            this._flatMesh(this.ringGeo, this.hintMat, hint.from);
            this._flatMesh(this.ringGeo, this.hintMat, hint.to);
        }
    }

    setOrientation(color) {
        this.orientation = color;
        const target = color === WHITE ? new THREE.Vector3(0, 10.4, 12.2) : new THREE.Vector3(0, 10.4, -12.2);
        const start = this.camera.position.clone();
        const radius = start.length();
        target.setLength(radius);
        this._tween({
            duration: 0.8,
            update: (t) => {
                const e = t * t * (3 - 2 * t);
                this.camera.position.lerpVectors(start, target, e);
                this.camera.lookAt(0, 0, 0);
            },
            done: () => this.controls.update()
        });
    }

    resize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (!w || !h) return;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    _loop() {
        const dt = Math.min(this.clock.getDelta(), 0.05);
        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const tw = this.tweens[i];
            tw.elapsed += dt;
            const t = Math.min(1, tw.elapsed / tw.duration);
            tw.update(t);
            if (t >= 1) {
                this.tweens.splice(i, 1);
                tw.done && tw.done();
            }
        }
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
