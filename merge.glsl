/**
 * Sample input phases and merge waveforms, distributing by channels
 */

precision lowp float;

uniform sampler2D phase;
uniform sampler2D source;
uniform sampler2D formants;
uniform float sampleRate;
uniform float width;
uniform float height;
uniform float waveform;
uniform float channels;

void main () {
	vec2 xy = vec2(gl_FragCoord.x / width, gl_FragCoord.y / height);

	vec4 phaseValue = texture2D(phase, vec2(gl_FragCoord.x / width, 0));

	gl_FragColor = vec4(
		texture2D(source, vec2(phaseValue.x, 0)).x,
		texture2D(source, vec2(phaseValue.y, 0)).x,
		texture2D(source, vec2(phaseValue.z, 0)).x,
		texture2D(source, vec2(phaseValue.w, 0)).x
	);
}