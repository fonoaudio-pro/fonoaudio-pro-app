import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface AvatarProps {
    volume: number; // 0 to 1 (or higher)
    isListening: boolean;
    isThinking: boolean;
}

const AnimatedSphere = ({ volume, isListening, isThinking }: AvatarProps) => {
    const meshRef = useRef<THREE.Mesh>(null);

    // Smooth volume for animation
    const currentVolume = useRef(0);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        // Smoothly interpolate volume
        const targetVolume = isListening ? volume : (isThinking ? 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2 : 0.1);
        currentVolume.current = THREE.MathUtils.lerp(currentVolume.current, targetVolume, 0.1);

        // Scale based on volume
        const scale = 1 + currentVolume.current * 0.5;
        meshRef.current.scale.set(scale, scale, scale);

        // Rotate slowly
        meshRef.current.rotation.x += delta * 0.2;
        meshRef.current.rotation.y += delta * 0.5;

        // Distort material based on state
        const material = meshRef.current.material as any;
        if (material) {
            material.distort = 0.3 + currentVolume.current * 0.5;
            material.speed = isThinking ? 5 : 2;

            // Color transition
            const targetColor = isListening
                ? new THREE.Color("#3b82f6") // Blue when listening
                : isThinking
                    ? new THREE.Color("#a855f7") // Purple when thinking
                    : new THREE.Color("#64748b"); // Slate when idle

            material.color.lerp(targetColor, 0.1);
        }
    });

    return (
        <Sphere ref={meshRef} args={[1, 64, 64]}>
            <MeshDistortMaterial
                color="#3b82f6"
                attach="material"
                distort={0.3}
                speed={2}
                roughness={0.2}
                metalness={0.8}
            />
        </Sphere>
    );
};

const Avatar = ({ volume, isListening, isThinking }: AvatarProps) => {
    return (
        <div className="w-full h-full min-h-[200px]">
            <Canvas
                camera={{ position: [0, 0, 3] }}
                gl={{
                    preserveDrawingBuffer: true,
                    antialias: true,
                    alpha: true
                }}
                onCreated={({ gl }) => {
                    gl.setClearColor('#1e293b', 1);
                }}
            >
                <Suspense fallback={null}>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} />
                    <pointLight position={[-10, -10, -10]} intensity={0.5} color="blue" />

                    <AnimatedSphere volume={volume} isListening={isListening} isThinking={isThinking} />

                    <Environment preset="city" />
                    <OrbitControls enableZoom={false} enablePan={false} />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default Avatar;
