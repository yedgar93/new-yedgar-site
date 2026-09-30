type HoverListener = (index: number | null) => void;

interface InteractionState {
  pointerX: number;
  pointerY: number;
  hovered: number | null;
  ring: number;
  ringTarget: number;
  ringVelocity: number;
  activeTrack: number;
  suppressClick: boolean;
  cursorX: number;
  cursorY: number;
  cursorZ: number;
  cursorOn: number;
}

const state: InteractionState = {
  pointerX: 0,
  pointerY: 0,
  hovered: null,
  ring: 0,
  ringTarget: 0,
  ringVelocity: 0,
  activeTrack: 0,
  suppressClick: false,
  cursorX: 0,
  cursorY: 0,
  cursorZ: 0,
  cursorOn: 0,
};

const hoverListeners = new Set<HoverListener>();

export const interaction = {
  get(): InteractionState {
    return state;
  },
  setPointer(x: number, y: number) {
    state.pointerX = x;
    state.pointerY = y;
  },
  addRing(delta: number) {
    state.ringVelocity += delta;
    state.ringTarget += delta;
  },
  setHovered(index: number | null) {
    if (state.hovered === index) return;
    state.hovered = index;
    hoverListeners.forEach((listener) => listener(index));
  },
  subscribeHover(listener: HoverListener) {
    hoverListeners.add(listener);
    return () => {
      hoverListeners.delete(listener);
    };
  },
  setActiveTrack(index: number) {
    state.activeTrack = index;
  },
  setSuppressClick(value: boolean) {
    state.suppressClick = value;
  },
  setCursor(x: number, y: number, z: number, on: number) {
    state.cursorX = x;
    state.cursorY = y;
    state.cursorZ = z;
    state.cursorOn = on;
  },
};
