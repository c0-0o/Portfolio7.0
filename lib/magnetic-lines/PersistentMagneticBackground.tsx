"use client";

import { useEffect, useState } from "react";
import { loadPersistedScene, SCENE_CHANGE_EVENT } from "./persistence";
import { DEFAULT_SCENE } from "./defaultScene";
import { MagneticBackgroundLines } from "./MagneticBackgroundLines";

export function PersistentMagneticBackground() {
  const [scene, setScene] = useState(DEFAULT_SCENE);
  useEffect(() => {
    const update = () => setScene(loadPersistedScene());
    update();
    window.addEventListener(SCENE_CHANGE_EVENT, update);
    return () => window.removeEventListener(SCENE_CHANGE_EVENT, update);
  }, []);
  return <MagneticBackgroundLines config={scene} />;
}