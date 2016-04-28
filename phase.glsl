/**
 * Generating phase texture of formants data
 */

precision lowp float;

uniform sampler2D formants;
uniform sampler2D noise;
uniform sampler2D phase;
uniform float sampleRate;
uniform float width;
uniform float height;

float getStep (float f) {
	return f / sampleRate;
}

void main (void) {
	vec2 coord = floor(gl_FragCoord.xy);
	vec2 xy = vec2(coord.x / width, coord.y / height);

	float range = 1000.;
	float lastSample = texture2D(phase, vec2( (width - 0.5) / width, xy.y)).w;

	vec4 sample, formant;

	//512x4 is 4096 — pretty much for buffer
	for (float i = 0.; i < 512.; i++) {
		//TODO: read 4 formants
		formant = texture2D(formants, vec2( i / width, xy.y));

		sample = texture2D(noise, vec2( i / width, xy.y));

		sample.x = fract( getStep(formant.x + sample.x*range - range*0.5) + lastSample);
		sample.y = fract( getStep(formant.x + sample.y*range - range*0.5) + sample.x);
		sample.z = fract( getStep(formant.x + sample.z*range - range*0.5) + sample.y);
		sample.w = fract( getStep(formant.x + sample.w*range - range*0.5) + sample.z);

		lastSample = sample.w;

		if (coord.x == i) {
			gl_FragColor = sample;
			break;
		}

		if (i >= width) {
			break;
		}
	}
}