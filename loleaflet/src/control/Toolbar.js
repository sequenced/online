/* -*- js-indent-level: 8 -*- */
/*
 * Toolbar handler
 */

/* global app $ window vex sanitizeUrl brandProductName brandProductURL _ Hammer */
L.Map.include({

	// a mapping of uno commands to more readable toolbar items
	unoToolbarCommands: [
		'.uno:StyleApply',
		'.uno:CharFontName'
	],

	_modalDialogOptions: {
		overlayClose:true,
		opacity: 80,
		overlayCss: {
			backgroundColor : '#000'
		},
		containerCss: {
			overflow : 'hidden',
			backgroundColor : '#fff',
			padding : '20px',
			border : '2px solid #000'
		}
	},

	// Triple-clicking turns profiling on in the kit process for
	// this document (it is already if the server is running with log level
	// "trace"). Triple-clicking again turns it off. Etc.
	_profilingRequestedToggle: false,

	onFontSelect: function(e) {
		var font = e.target.value;
		this.applyFont(font);
		this.focus();
	},

	createFontSelector: function(nodeSelector) {
		var that = this;

		var createSelector = function() {
			var commandValues = that.getToolbarCommandValues('.uno:CharFontName');

			var data = []; // reset data in order to avoid that the font select box is populated with styles, too.
			// Old browsers like IE11 et al don't like Object.keys with
			// empty arguments
			if (typeof commandValues === 'object') {
				data = data.concat(Object.keys(commandValues));
			}

			$(nodeSelector).select2({
				data: data.sort(function (a, b) {  // also sort(localely)
					return a.localeCompare(b);
				}),
				placeholder: _('Font')
			});

			$(nodeSelector).on('select2:select', that.onFontSelect.bind(that));

			var items = that['stateChangeHandler'];
			var val = items.getItemValue('.uno:CharFontName');
			$(nodeSelector).val(val).trigger('change');
		};

		createSelector();

		var onCommandStateChanged = function(e) {
			var commandName = e.commandName;

			if (commandName !== '.uno:CharFontName')
				return;

			var state = e.state;
			var found = false;

			$(nodeSelector + ' option').each(function () {
				var value = this.value;
				if (value.toLowerCase() === state.toLowerCase()) {
					found = true;
					return;
				}
			});

			if (!found) {
				$(nodeSelector)
					.append($('<option></option>')
						.text(state));
			}

			$(nodeSelector).val(state).trigger('change');
		};

		var onFontListChanged = function(e) {
			if (e.commandName === '.uno:CharFontName')
				createSelector();
		};

		this.off('commandstatechanged', onCommandStateChanged);
		this.on('commandstatechanged', onCommandStateChanged);
		this.off('updatetoolbarcommandvalues', onFontListChanged);
		this.on('updatetoolbarcommandvalues', onFontListChanged);
	},

	onFontSizeSelect: function(e) {
		this.applyFontSize(e.target.value);
		this.focus();
	},

	createFontSizeSelector: function(nodeSelector) {
		var data = [6, 7, 8, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20,
			22, 24, 26, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
		$(nodeSelector).select2({
			data: data,
			placeholder: ' ',
			//Allow manually entered font size.
			createTag: function(query) {
				return {
					id: query.term,
					text: query.term,
					tag: true
				};
			},
			tags: true,
			sorter: function(data) { return data.sort(function(a, b) {
				return parseFloat(a.text) - parseFloat(b.text);
			});}
		});
		$(nodeSelector).off('select2:select', this.onFontSizeSelect.bind(this)).on('select2:select', this.onFontSizeSelect.bind(this));

		var onCommandStateChanged = function(e) {
			var commandName = e.commandName;

			if (commandName !== '.uno:FontHeight')
				return;

			var state = e.state;
			var found = false;

			if (state === '0') {
				state = '';
			}

			$(nodeSelector + ' option').each(function (i, e) {
				if ($(e).text() === state) {
					found = true;
				}
			});

			if (!found) {
				// we need to add the size
				$(nodeSelector)
					.append($('<option>')
						.text(state).val(state));
			}

			$(nodeSelector).val(state).trigger('change');
		};

		this.off('commandstatechanged', onCommandStateChanged);
		this.on('commandstatechanged', onCommandStateChanged);
	},

	applyFont: function (fontName) {
		if (this.isPermissionEdit()) {
			var msg = 'uno .uno:CharFontName {' +
				'"CharFontName.FamilyName": ' +
					'{"type": "string", "value": "' + fontName + '"}}';
			app.socket.sendMessage(msg);
		}
	},

	applyFontSize: function (fontSize) {
		if (this.isPermissionEdit()) {
			var msg = 'uno .uno:FontHeight {' +
				'"FontHeight.Height": ' +
				'{"type": "float", "value": "' + fontSize + '"}}';
			app.socket.sendMessage(msg);
		}
	},

	getToolbarCommandValues: function (command) {
		if (this._docLayer) {
			return this._docLayer._toolbarCommandValues[command];
		}

		return undefined;
	},

	downloadAs: function (name, format, options, id) {
		if (this._fatal) {
			return;
		}

		id = id || 'export'; // not any special download, simple export

		if ((id === 'print' && this['wopi'].DisablePrint) ||
			(id === 'export' && this['wopi'].DisableExport)) {
			this.hideBusy();
			return;
		}

		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}

		if (!window.ThisIsAMobileApp)
			this.showBusy(_('Downloading...'), false);
		app.socket.sendMessage('downloadas ' +
			'name=' + encodeURIComponent(name) + ' ' +
			'id=' + id + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	},

	print: function () {
		if (window.ThisIsTheiOSApp || window.ThisIsTheAndroidApp) {
			window.postMobileMessage('PRINT');
		} else {
			this.showBusy(_('Downloading...'), false);
			this.downloadAs('print.pdf', 'pdf', null, 'print');
		}
	},

	saveAs: function (url, format, options) {
		if (url === undefined || url == null) {
			return;
		}
		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}

		this.showBusy(_('Saving...'), false);
		app.socket.sendMessage('saveas ' +
			'url=wopi:' + encodeURIComponent(url) + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	},

	renameFile: function (filename) {
		if (!filename) {
			return;
		}
		this.showBusy(_('Renaming...'), false);
		app.socket.sendMessage('renamefile filename=' + encodeURIComponent(filename));
	},

	applyStyle: function (style, familyName) {
		if (!style || !familyName) {
			this.fire('error', {cmd: 'setStyle', kind: 'incorrectparam'});
			return;
		}
		if (this.isPermissionEdit()) {
			var msg = 'uno .uno:StyleApply {' +
					'"Style":{"type":"string", "value": "' + style + '"},' +
					'"FamilyName":{"type":"string", "value":"' + familyName + '"}' +
					'}';
			app.socket.sendMessage(msg);
		}
	},

	applyLayout: function (layout) {
		if (!layout) {
			this.fire('error', {cmd: 'setLayout', kind: 'incorrectparam'});
			return;
		}
		if (this.isPermissionEdit()) {
			var msg = 'uno .uno:AssignLayout {' +
					'"WhatPage":{"type":"unsigned short", "value": "' + this.getCurrentPartNumber() + '"},' +
					'"WhatLayout":{"type":"unsigned short", "value": "' + layout + '"}' +
					'}';
			app.socket.sendMessage(msg);
		}
	},

	save: function(dontTerminateEdit, dontSaveIfUnmodified, extendedData) {
		var msg = 'save' +
					' dontTerminateEdit=' + (dontTerminateEdit ? 1 : 0) +
					' dontSaveIfUnmodified=' + (dontSaveIfUnmodified ? 1 : 0);

		if (extendedData !== undefined) {
			msg += ' extendedData=' + extendedData;
		}

		app.socket.sendMessage(msg);
	},

	messageNeedsToBeRedirected: function(command) {
		if (command === '.uno:EditHyperlink') {
			var that = this;
			setTimeout(function () { that.showHyperlinkDialog(); }, 500);
			return true;
		}
		else {
			return false;
		}
	},

	sendUnoCommand: function (command, json) {
		var isAllowedInReadOnly = false;
		var allowedCommands = ['.uno:Save', '.uno:WordCountDialog', '.uno:EditAnnotation', '.uno:InsertAnnotation', '.uno:DeleteAnnotation'];

		for (var i in allowedCommands) {
			if (allowedCommands[i] === command) {
				isAllowedInReadOnly = true;
				break;
			}
		}
		if (command.startsWith('.uno:SpellOnline')) {
			var map = this;
			var val = map['stateChangeHandler'].getItemValue('.uno:SpellOnline');

			// proceed if the toggle button is pressed
			if (val && (json === undefined || json === null)) {
				 // because it is toggle, state has to be the opposite
				var state = !(val === 'true');
				if (window.isLocalStorageAllowed)
					window.localStorage.setItem('SpellOnline', state);
			}
		}

		if (this.dialog.hasOpenedDialog())
			this.dialog.blinkOpenDialog();
		else if (this.isPermissionEdit() || isAllowedInReadOnly) {
			if (!this.messageNeedsToBeRedirected(command))
				app.socket.sendMessage('uno ' + command + (json ? ' ' + JSON.stringify(json) : ''));
		}
	},

	toggleCommandState: function (unoState) {
		if (this.isPermissionEdit()) {
			if (!unoState.startsWith('.uno:')) {
				unoState = '.uno:' + unoState;
			}
			this.sendUnoCommand(unoState);
		}
	},

	insertFile: function (file) {
		this.fire('insertfile', {file: file});
	},

	insertURL: function (url) {
		this.fire('inserturl', {url: url});
	},

	selectBackground: function (file) {
		this.fire('selectbackground', {file: file});
	},

	_doVexOpenHelpFile: function(data, id, map) {
		var productName;
		if (window.ThisIsAMobileApp) {
			productName = window.MobileAppName;
		} else {
			productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'Collabora Online Development Edition';
		}
		var w;
		var iw = window.innerWidth;
		if (iw < 768) {
			w = iw - 30;
		}
		else if (iw > 1920) {
			w = 960;
		}
		else {
			w = iw / 5 + 590;
		}
		vex.open({
			unsafeContent: data,
			showCloseButton: true,
			escapeButtonCloses: true,
			overlayClosesOnClick: true,
			closeAllOnPopState: false,
			buttons: {},
			afterOpen: function() {
				var $vexContent = $(this.contentEl);
				this.contentEl.style.width = w + 'px';
				var i;
				// Display keyboard shortcut or online help
				if (id === 'keyboard-shortcuts') {
					document.getElementById('online-help').style.display='none';
					// Display help according to document opened
					if (map.getDocType() === 'text') {
						document.getElementById('text-shortcuts').style.display='block';
					}
					else if (map.getDocType() === 'spreadsheet') {
						document.getElementById('spreadsheet-shortcuts').style.display='block';
					}
					else if (map.getDocType() === 'presentation') {
						document.getElementById('presentation-shortcuts').style.display='block';
					}
					else if (map.getDocType() === 'drawing') {
						document.getElementById('drawing-shortcuts').style.display='block';
					}
				} else /* id === 'online-help' */ {
					document.getElementById('keyboard-shortcuts').style.display='none';
					if (window.socketProxy) {
						var helpdiv = document.getElementById('online-help');
						var imgList = helpdiv.querySelectorAll('img');
						for (var p = 0; p < imgList.length; p++) {
							var imgSrc = imgList[p].src;
							imgSrc = imgSrc.substring(imgSrc.indexOf('/images'));
							imgList[p].src = window.host + window.serviceRoot + '/loleaflet/dist'+ imgSrc;
						}
					}
					// Display help according to document opened
					if (map.getDocType() === 'text') {
						var x = document.getElementsByClassName('text');
						for (i = 0; i < x.length; i++) {
							x[i].style.display = 'block';
						}
					}
					else if (map.getDocType() === 'spreadsheet') {
						x = document.getElementsByClassName('spreadsheet');
						for (i = 0; i < x.length; i++) {
							x[i].style.display = 'block';
						}
					}
					else if (map.getDocType() === 'presentation' || map.getDocType() === 'drawing') {
						x = document.getElementsByClassName('presentation');
						for (i = 0; i < x.length; i++) {
							x[i].style.display = 'block';
						}
					}
				}

				// Let's translate
				var max;
				var translatableContent = $vexContent.find('h1');
				for (i = 0, max = translatableContent.length; i < max; i++) {
					translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
				}
				translatableContent = $vexContent.find('h2');
				for (i = 0, max = translatableContent.length; i < max; i++) {
					translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
				}
				translatableContent = $vexContent.find('h3');
				for (i = 0, max = translatableContent.length; i < max; i++) {
					translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
				}
				translatableContent = $vexContent.find('h4');
				for (i = 0, max = translatableContent.length; i < max; i++) {
					translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
				}
				translatableContent = $vexContent.find('td');
				for (i = 0, max = translatableContent.length; i < max; i++) {
					translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
				}
				translatableContent = $vexContent.find('p');
				for (i = 0, max = translatableContent.length; i < max; i++) {
					translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
				}
				translatableContent = $vexContent.find('button'); // TOC
				for (i = 0, max = translatableContent.length; i < max; i++) {
					translatableContent[i].innerHTML = translatableContent[i].innerHTML.toLocaleString();
				}

				//translatable screenshots
				var supportedLanguage = ['fr', 'it', 'de', 'es', 'pt-BR'];
				var currentLanguage = String.locale;
				if (supportedLanguage.indexOf(currentLanguage) >= 0) {
					translatableContent = $($vexContent.find('.screenshot')).find('img');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].src = translatableContent[i].src.replace('/en/', '/'+currentLanguage+'/');
					}
				}

				// Substitute %productName in Online Help
				if (id === 'online-help') {
					var productNameContent = $vexContent.find('span.productname');
					for (i = 0, max = productNameContent.length; i < max; i++) {
						productNameContent[i].innerHTML = productNameContent[i].innerHTML.replace(/%productName/g, productName);
					}
				}

				// Special Mac key names
				if (navigator.appVersion.indexOf('Mac') != -1 || navigator.userAgent.indexOf('Mac') != -1) {
					var ctrl = /Ctrl/g;
					var alt = /Alt/g;
					if (String.locale.startsWith('de') || String.locale.startsWith('dsb') || String.locale.startsWith('hsb')) {
						ctrl = /Strg/g;
					}
					if (String.locale.startsWith('lt')) {
						ctrl = /Vald/g;
					}
					if (String.locale.startsWith('sl')) {
						ctrl = /Krmilka/gi;
						alt = /Izmenjalka/gi;
					}
					if (id === 'keyboard-shortcuts') {
						document.getElementById('keyboard-shortcuts').innerHTML = document.getElementById('keyboard-shortcuts').innerHTML.replace(ctrl, '⌘').replace(alt, '⌥');
					}
					if (id === 'online-help') {
						document.getElementById('online-help').innerHTML = document.getElementById('online-help').innerHTML.replace(ctrl, '⌘').replace(alt, '⌥');
					}
				}

				$vexContent.attr('tabindex', -1);
				$vexContent.focus();
				// workaround for https://github.com/HubSpot/vex/issues/43
				$('.vex-overlay').css({ 'pointer-events': 'none'});
			},
			beforeClose: function () {
				map.focus();
			}
		});
	},

	showHelp: function(id) {
		var map = this;
		if (window.ThisIsAMobileApp) {
			map._doVexOpenHelpFile(window.HelpFile, id, map);
			return;
		}
		var helpLocation = 'loleaflet-help.html';
		if (window.socketProxy)
			helpLocation = window.host + window.serviceRoot + '/loleaflet/dist/' + helpLocation;
		$.get(helpLocation, function(data) {
			map._doVexOpenHelpFile(data, id, map);
		});
	},

	// show the actual welcome dialog with the given data
	_showWelcomeDialogVex: function(data, calledFromMenu) {
		var w;
		var iw = window.innerWidth;
		var hasDismissBtn = window.enableWelcomeMessageButton;
		var btnText = 'I understand the risks';

		if (iw < 768) {
			w = iw - 30;
		}
		else if (iw > 1920) {
			w = 960;
		}
		else {
			w = iw / 5 + 590;
		}

		if (!hasDismissBtn && window.mode.isMobile()) {
			var ih = window.innerHeight;
			var h = ih / 2;
			if (iw < 768) {
				h = ih - 170; // Hopefully enough padding to avoid extra scroll-bar on mobile,
			}
			var containerDiv = '<div style="max-height:' + h + 'px;overflow-y:auto;">';
			containerDiv += data;
			containerDiv += '</div>';
			data = containerDiv;
			btnText = 'Dismiss';
			hasDismissBtn = true;
		}

		// show the dialog
		var map = this;
		vex.dialog.open({
			unsafeMessage: data,
			showCloseButton: !hasDismissBtn,
			escapeButtonCloses: false,
			overlayClosesOnClick: false,
			className: 'vex-theme-plain vex-welcome-mobile',
			closeAllOnPopState: false,
			focusFirstInput: false, // Needed to avoid auto-scroll to the bottom
			buttons: !hasDismissBtn ? {} : [
				$.extend({}, vex.dialog.buttons.YES, { text: _(btnText) }),
			],
			afterOpen: function() {
				var $vexContent = $(this.contentEl);
				this.contentEl.style.width = w + 'px';

				$vexContent.attr('tabindex', -1);
				// Work-around to avoid the ugly all-bold dialog message on mobile
				if (window.mode.isMobile()) {
					var dlgMsg = document.getElementsByClassName('vex-dialog-message')[0];
					dlgMsg.setAttribute('class', 'vex-content');
				}
				$vexContent.focus();
				// workaround for https://github.com/HubSpot/vex/issues/43
				$('.vex-overlay').css({ 'pointer-events': 'none'});
			},
			beforeClose: function () {
				if (!calledFromMenu) {
					localStorage.setItem('WSDWelcomeVersion', app.socket.WSDServer.Version);
				}
				map.focus();
			}
		});
	},

	showWelcomeDialog: function(calledFromMenu) {
		console.log('showWelcomeDialog, calledFromMenu: ' + calledFromMenu);
		var welcomeLocation = 'welcome/welcome-' + String.locale + '.html';
		if (window.socketProxy)
			welcomeLocation = window.host + window.serviceRoot + '/loleaflet/dist/' + welcomeLocation;

		var map = this;

		// if the user doesn't accept cookies, or we get several triggers,
		// ensure we only ever do this once.
		if (!calledFromMenu && map._alreadyShownWelcomeDialog)
			return;
		map._alreadyShownWelcomeDialog = true;

		// try to load the welcome message
		$.get(welcomeLocation)
			.done(function(data) {
				map._showWelcomeDialogVex(data, calledFromMenu);
			})
			.fail(function() {
				var currentDate = new Date();
				localStorage.setItem('WSDWelcomeDisabled', 'true');
				localStorage.setItem('WSDWelcomeDisabledDate', currentDate.toDateString());

				if (calledFromMenu)
					map._showWelcomeDialogVex(_('We are sorry, the information about the latest updates is not available.'));
			});
	},

	shouldWelcome: function() {
		if (!window.isLocalStorageAllowed || !window.enableWelcomeMessage)
			return false;

		var storedVersion = localStorage.getItem('WSDWelcomeVersion');
		var currentVersion = app.socket.WSDServer.Version;
		var welcomeDisabledCookie = localStorage.getItem('WSDWelcomeDisabled');
		var welcomeDisabledDate = localStorage.getItem('WSDWelcomeDisabledDate');
		var isWelcomeDisabled = false;

		if (welcomeDisabledCookie && welcomeDisabledDate) {
			// Check if we are stil in the same day
			var currentDate = new Date();
			if (welcomeDisabledDate === currentDate.toDateString())
				isWelcomeDisabled = true;
			else {
				//Values expired. Clear the local values
				localStorage.removeItem('WSDWelcomeDisabled');
				localStorage.removeItem('WSDWelcomeDisabledDate');
			}
		}

		if ((!storedVersion || storedVersion !== currentVersion) && !isWelcomeDisabled) {
			return true;
		}

		return false;
	},

	showLOAboutDialog: function() {
		// Move the div sitting in 'body' as vex-content and make it visible
		var content = $('#about-dialog').clone().css({display: 'block'});
		// fill product-name and product-string
		var productName;
		if (window.ThisIsAMobileApp) {
			productName = window.MobileAppName;
		} else {
			productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'Collabora Online Development Edition';
		}
		var productURL = (typeof brandProductURL !== 'undefined') ? brandProductURL : 'https://collaboraonline.github.io/';
		content.find('#product-name').text(productName).addClass('product-' + productName.split(/[ ()]+/).join('-').toLowerCase());
		var productString = _('This version of %productName is powered by');
		var productNameWithURL;
		if (!window.ThisIsAMobileApp)
			productNameWithURL = '<a href="' + sanitizeUrl.sanitizeUrl(productURL) +
								 '" target="_blank">' + productName + '</a>';
		else
			productNameWithURL = productName;
		content.find('#product-string').html(productString.replace('%productName', productNameWithURL));

		if (window.socketProxy)
			content.find('#slow-proxy').text(_('"Slow Proxy"'));

		var w;
		var iw = window.innerWidth;
		if (iw < 768) {
			w = iw - 30;
		}
		else if (iw > 1920) {
			w = 960;
		}
		else {
			w = iw / 5 + 590;
		}
		var map = this;
		var handler = function(event) {
			if (event.keyCode === 68) {
				map._docLayer.toggleTileDebugMode();
			}
		};
		vex.open({
			unsafeContent: content[0].outerHTML,
			showCloseButton: true,
			escapeButtonCloses: true,
			overlayClosesOnClick: true,
			buttons: {},
			afterOpen: function() {

				var touchGesture = map['touchGesture'];
				if (touchGesture && touchGesture._hammer) {
					touchGesture._hammer.off('tripletap', L.bind(touchGesture._onTripleTap, touchGesture));
				}

				var $vexContent = $(this.contentEl);
				var hammer = new Hammer.Manager($vexContent.get(0));
				hammer.add(new Hammer.Tap({ taps: 3 }));
				hammer.on('tap', function() {
					map._docLayer.toggleTileDebugMode();

					map._socket.sendMessage('traceeventrecording ' + (map._profilingRequestedToggle ? 'stop' : 'start'));

					// Just as a test, uncomment this to toggle SAL_WARN and SAL_INFO
					// selection between two states: 1) the default as directed by the
					// SAL_LOG environment variable, and 2) all warnings on plus SAL_INFO for sc.
					//
					// (Note that loolwsd sets the SAL_LOG environment variable to
					// "-WARN-INFO", i.e. the default is that nothing is logged)

					// map._socket.sendMessage('sallogoverride ' + (map._profilingRequestedToggle ? 'default' : '+WARN+INFO.sc'));

					map._profilingRequestedToggle = !map._profilingRequestedToggle;
				});

				this.contentEl.style.width = w + 'px';

				$(window).bind('keyup.vex', handler);
				// workaround for https://github.com/HubSpot/vex/issues/43
				$('.vex-overlay').css({ 'pointer-events': 'none'});
			},
			beforeClose: function () {
				$(window).unbind('keyup.vex', handler);
				var touchGesture = map['touchGesture'];
				if (touchGesture && touchGesture._hammer) {
					touchGesture._hammer.on('tripletap', L.bind(touchGesture._onTripleTap, touchGesture));
				}
				map.focus();
			}
		});
	},

	extractContent: function(html) {
		var parser = new DOMParser;
		return parser.parseFromString(html, 'text/html').documentElement.getElementsByTagName('body')[0].textContent;
	},

	makeURLFromStr: function(str) {
		if (!(str.toLowerCase().startsWith('http://') || str.toLowerCase().startsWith('https://'))) {
			str = 'http://' + str;
		}
		return str;
	},

	showHyperlinkDialog: function() {
		var map = this;
		var text = '';
		var link = '';
		if (this.hyperlinkUnderCursor && this.hyperlinkUnderCursor.text && this.hyperlinkUnderCursor.link) {
			text = this.hyperlinkUnderCursor.text;
			link = this.hyperlinkUnderCursor.link;
		} else if (this._clip && this._clip._selectionType == 'text') {
			if (map['stateChangeHandler'].getItemValue('.uno:Copy') === 'enabled') {
				text = this.extractContent(this._clip._selectionContent);
			}
		} else if (this._docLayer._selectedTextContent) {
			text = this.extractContent(this._docLayer._selectedTextContent);
		}

		vex.dialog.open({
			contentClassName: 'hyperlink-dialog',
			message: _('Insert hyperlink'),
			input: [
				_('Text') + '<input name="text" id="hyperlink-text-box" type="text" value="' + text + '"/>',
				_('Link') + '<input name="link" id="hyperlink-link-box" type="text" value="' + link + '"/>'
			].join(''),
			buttons: [
				$.extend({}, vex.dialog.buttons.YES, { text: _('OK') }),
				$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
			],
			callback: function(data) {
				if (data && data.link != '') {
					var command = {
						'Hyperlink.Text': {
							type: 'string',
							value: data.text
						},
						'Hyperlink.URL': {
							type: 'string',
							value: map.makeURLFromStr(data.link)
						}
					};
					map.sendUnoCommand('.uno:SetHyperlink', command);
					map.focus();
				}
				else {
					map.focus();
				}
			},
			afterOpen: function() {
				setTimeout(function() {
					if (document.getElementById('hyperlink-text-box').value.trim() !== '') {
						document.getElementById('hyperlink-link-box').focus();
					}
					else {
						document.getElementById('hyperlink-text-box').focus();
					}
				}, 0);
			}
		});
	},

	openRevisionHistory: function () {
		var map = this;
		// if we are being loaded inside an iframe, ask
		// our host to show revision history mode
		map.fire('postMessage', {msgId: 'rev-history', args: {Deprecated: true}});
		map.fire('postMessage', {msgId: 'UI_FileVersions'});
	},
	openShare: function () {
		var map = this;
		map.fire('postMessage', {msgId: 'UI_Share'});
	},
	openSaveAs: function () {
		var map = this;
		map.fire('postMessage', {msgId: 'UI_SaveAs'});
	},
});
