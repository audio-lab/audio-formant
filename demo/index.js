/**
 * Construct formants picture
 *
 * @module
 */

var Speaker = require('audio-speaker');
var FormantStream = require('formant-stream');
var Spectrogram = require('audio-spectrogram');
var Through = require('audio-through');


/**
 * @constructor
 */
function Composer (element, options) {
	this.formants = [];

	this.add(0,0,0,0);
}


/**
 * Add new formant pixel to composer
 */
Composer.prototype.add = function (f, a, q, p) {

};


Composer.prototype.createItem = function () {
	var itemEl = document.createElement('div');
	itemEl.className = 'formant-item';

	itemEl.innerHTML = `
		<input class="formant-item-controller formant-item-controller-frequency" type="number" min="0" max="1" step="0.01" data-formant-id="${}"/>
		<input class="formant-item-controller formant-item-controller-quality" type="number" min="0" max="1" step="0.01" data-formant-id="${}"/>
		<input class="formant-item-controller formant-item-controller-panning" type="number" min="0" max="1" step="0.01" data-formant-id="${}"/>
		<input class="formant-item-controller formant-item-controller-amplitude" type="number" min="0" max="1" step="0.01" data-formant-id="${}"/>
	`;

	itemEl.querySelectorAll('.formant-item-controller').forEach(function (controllerEl) {
		controllerEl.addEventListener('input', function () {

		});
	});
}