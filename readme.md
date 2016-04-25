SOM (Sound Object Model) is unique sound description class based on describing and reproducing sound on shaders.

Formant speaker converts formants sound data to waveform.
It takes a state — "soundprint", and generates audio based on it.

```js
var toSound = require('formant-to-sound');

var result = toSound(data);
```

## Scheme of generating sound

To understand the idea behind formants read [formants ref]. Briefly, the sound is produced by randomizing phase and picking a sample corresponding to the phase from a source, which can be a sine wave etc. WebGL is perfect for interpolating source based on required phase and handling multitude of samples in parallel. Source waveform is a texture, phase is x-coordinate within that texture.

The main problem with generating sound in webgl is that we need correlation info between samples, i. e. in current sample we should know the value of previous sample. That is impossible to do based on fragments, because they are designed to do things in parallel. The solution is populating varyings array in vertex shader, and converting them to fragments in fragment shader.

The scheme comprises 5 shaders:

1. _even and odd shaders_ to render even and odd chunks of phase info.
2. _merging shader_ to merge chunks into a single phase texture.
3. _sampling shader_ to sample source values based on the phase texture.
4. _copying shader_ to save phase info back into odd shader.

The principle is generating additive noise steps and putting them to varyings, like so:
[image]

Maximum number of varyings can be 29 vec4’s, so we limit size of rendered viewport to 29px wide, which is 112 sound samples. In that, the output noisy wave is comprised of 112 wide chunks.

First, we generate 29px of noise samples chunks. We restrict viewport to 0..32 (we should use 2^n textures) and step over buffer with shift multiple of 29 - the number of varyings.

[image]

Then we merge even/odd chunked phase info into a single seamless phase texture.

[image a + b → phase]

Then we sample phase from the source

[phase + source → signal]

That’s basically it. We just save phase info back to odd buffer to provide seamless connection with the next buffer.