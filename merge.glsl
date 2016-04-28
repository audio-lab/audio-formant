/**
 * Sample input phases and merge waveforms, distributing by channels
 */

precision lowp float;

uniform sampler2D phase;
uniform sampler2D source;
uniform float sampleRate;
uniform float width;
uniform float height;

void main () {
	vec2 coord = floor(gl_FragCoord.xy);
	vec2 xy = vec2(coord.x / width, coord.y / height);

	vec4 phaseValue = texture2D(phase, xy);

	gl_FragColor = vec4(
		texture2D(source, vec2(phaseValue.x, xy.y)).x,
		texture2D(source, vec2(phaseValue.y, xy.y)).x,
		texture2D(source, vec2(phaseValue.z, xy.y)).x,
		texture2D(source, vec2(phaseValue.w, xy.y)).x
	);
}