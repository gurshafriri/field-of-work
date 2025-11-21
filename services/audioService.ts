class AudioService {
    private audioCtx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    
    // Voices
    private oscLow: OscillatorNode | null = null;
    private oscHigh: OscillatorNode | null = null;
    private oscSub: OscillatorNode | null = null;
    
    // Effects
    private filterNode: BiquadFilterNode | null = null;
    private pannerLow: StereoPannerNode | null = null;
    private pannerHigh: StereoPannerNode | null = null;
    private delayNode: DelayNode | null = null;
    private delayGain: GainNode | null = null;

    private isPlaying = false;
    private isMuted = false;

    public initialize() {
        if (this.audioCtx) return;
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        this.audioCtx = new AudioContextClass();
    }

    public async start() {
        if (!this.audioCtx) this.initialize();
        if (!this.audioCtx) return;

        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        if (this.isPlaying) return;
        this.isPlaying = true;

        const now = this.audioCtx.currentTime;

        // --- SIGNAL CHAIN ---

        // Master Output
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0, now);
        this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.5, now + 3); // Smooth fade in
        this.masterGain.connect(this.audioCtx.destination);

        // Spatial Delay (Echo)
        this.delayNode = this.audioCtx.createDelay();
        this.delayNode.delayTime.value = 0.4; // 400ms delay
        
        this.delayGain = this.audioCtx.createGain();
        this.delayGain.gain.value = 0.3; // Feedback amount

        // Filter (Controlled by Scroll X)
        this.filterNode = this.audioCtx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 600; // Initial open setting
        this.filterNode.Q.value = 1;

        // Routing: Filter -> Master
        this.filterNode.connect(this.masterGain);
        
        // Routing: Filter -> Delay -> DelayGain -> Delay (Feedback) -> Master
        this.filterNode.connect(this.delayNode);
        this.delayNode.connect(this.delayGain);
        this.delayGain.connect(this.delayNode);
        this.delayNode.connect(this.masterGain);

        // 1. Sub Bass (Anchor - Center)
        this.oscSub = this.audioCtx.createOscillator();
        this.oscSub.type = 'sine';
        this.oscSub.frequency.value = 55; // A1
        const subGain = this.audioCtx.createGain();
        subGain.gain.value = 0.4;
        this.oscSub.connect(subGain).connect(this.filterNode);
        this.oscSub.start(now);

        // 2. Low Drone (Left Ear - Warmth)
        this.oscLow = this.audioCtx.createOscillator();
        this.oscLow.type = 'triangle';
        this.oscLow.frequency.value = 110; // A2
        
        this.pannerLow = this.audioCtx.createStereoPanner();
        this.pannerLow.pan.value = -0.6;

        const lowGain = this.audioCtx.createGain();
        lowGain.gain.value = 0.2;

        this.oscLow.connect(lowGain).connect(this.pannerLow).connect(this.filterNode);
        this.oscLow.start(now);

        // 3. High Texture (Right Ear - Shimmer)
        this.oscHigh = this.audioCtx.createOscillator();
        this.oscHigh.type = 'sine';
        this.oscHigh.frequency.value = 165; // E3 (Perfect 5th)

        this.pannerHigh = this.audioCtx.createStereoPanner();
        this.pannerHigh.pan.value = 0.6;

        const highGain = this.audioCtx.createGain();
        highGain.gain.value = 0.15;

        this.oscHigh.connect(highGain).connect(this.pannerHigh).connect(this.filterNode);
        this.oscHigh.start(now);
    }

    public updateParams(x: number, y: number) {
        // x, y are normalized 0 to 1
        if (!this.audioCtx || !this.filterNode || !this.oscLow || !this.oscHigh) return;
        
        const now = this.audioCtx.currentTime;
        const rampTime = 0.1; // Faster response to scroll

        // --- X AXIS (TECH): TIMBRE / BRIGHTNESS ---
        const minFilter = 300; 
        const maxFilter = 6000;
        const targetFreq = minFilter + (maxFilter - minFilter) * (x * x); 
        this.filterNode.frequency.setTargetAtTime(targetFreq, now, rampTime);

        // --- Y AXIS (ART): HARMONY / PITCH ---
        const root = 110; // A2
        
        // Osc Low: Fundamental
        const targetLow = root - (y * 30); 
        this.oscLow.frequency.setTargetAtTime(targetLow, now, rampTime);

        // Osc High: Harmonic
        const targetHigh = (root * 1.5) - (y * 35);
        this.oscHigh.frequency.setTargetAtTime(targetHigh, now, rampTime);
        
        // Modulate delay feedback based on X
        if (this.delayGain) {
            this.delayGain.gain.setTargetAtTime(0.2 + (x * 0.3), now, rampTime);
        }
    }

    public toggleMute(muted: boolean) {
        this.isMuted = muted;
        if (!this.audioCtx || !this.masterGain) return;
        
        const now = this.audioCtx.currentTime;
        // Smooth transition to avoid clicks
        if (muted) {
            this.masterGain.gain.setTargetAtTime(0, now, 0.1);
        } else {
            this.masterGain.gain.setTargetAtTime(0.5, now, 0.1);
        }
    }
}

export const audioService = new AudioService();