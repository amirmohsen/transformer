var
FS = require("fs-extra"),
Cheerio = require("cheerio"),
HTMLBeautify = require("js-beautify").html,
Mustache = require("mustache"),
ReverseMustache = require("reverse-mustache"),
Path = require("path"),
UUID = require("node-uuid"),
ngui = require('nw.gui'),
nwin = ngui.Window.get();

function Transformer () {

	var 
	$form = $("#transformer-form"),
	$dirInputs = $("input[type='file']"),
	$progressList = $("#transformation-status-modal div.modal-body ul.list-group"),
	templates = {},
	input = {},
	itemsRemaining = 0,
	working = false;
	
	init();

	function init () {

		$(function () {
			$('[data-toggle="tooltip"]').tooltip();
		});

		onload = function() {
			nwin.show();
			nwin.maximize();
		};

		FS.watch("./", function() {
			nwin.reloadDev();
		});

		loadTemplates();
		loadView();
		listen();
	}

	function loadTemplates(){
		var imports = document.querySelectorAll('link[rel="import"]');
		templates.getterFields
		for(var i=0; i<imports.length; i++){
			var $template = $(imports[i].import).find("template");
			templates[$template.attr("data-name")] = $template.html();
		}
	}

	function loadView(){
		$("div.tf-getters").append( newRow("getter-fields") );
		$("div.tf-setters").append( newRow("setter-fields") );
	}

	function listen () {

		$("body").on("click", "button.row-creation", addAndRemoveRows);

		$("body").on("change", "select.getters-prop-type", alternatePropName);

		$("body").on("change", "input[name='output[type]']", alternateOutput);

		$("body").on("keydown", "textarea.allow-tab-indentation", allowTabIndentation);

		$(document).on("keydown", keyboardShortcuts);

		$form.submit(readInput);
	}

	function addAndRemoveRows(event){
		var action, name, buttonName, $button, $currentFields, $newFields;

		$button = $(event.target);
		action = $button.attr("data-action");
		name = $button.attr("data-name");

		$currentFields = $button.closest("div." + name);

		if(action === "remove"){
			if($currentFields.siblings("div." + name).length > 0)
				$currentFields.remove();
			return;
		}

		$currentFields.after( newRow(name) );
	}

	function newRow(name){
		var $newRow = $(templates[name]);

		if(name==="getter-fields"){
			$newRow
				.find("div.tf-getters-props")
				.html(templates["getter-prop-fields"]);
		}

		return $newRow;
	}

	function alternatePropName(event) {
		var $dropdown = $(event.target),
			$dropdownCol = $dropdown.closest("div.resizing-column"),
			$nameCol = $dropdownCol.siblings("div.vanishing-column"),
			$nameInput = $nameCol.find("input.getters-prop-name"),
			value = $dropdown.val();

		switch(value){
			case "attr":
				if($dropdownCol.hasClass("col-xs-4"))
					return;
				turnPropNameOn();
				break;
			default:
				if($dropdownCol.hasClass("col-xs-6"))
					return;
				turnPropNameOff();
				break;
		}

		function turnPropNameOn(){
			$dropdownCol.removeClass("col-xs-6");
			$dropdownCol.addClass("col-xs-4");
			$nameCol.removeClass("hidden");
			$nameInput.removeAttr("disabled");
		}

		function turnPropNameOff(){
			$dropdownCol.removeClass("col-xs-4");
			$dropdownCol.addClass("col-xs-6");
			$nameCol.addClass("hidden");
			$nameInput.val("");
			$nameInput.attr("disabled","");
		}
	}

	function alternateOutput(event){
		var 
			$radioButton = $(event.target),
			$textArea = $("textarea[name='output[template]']"),
			outputType = $radioButton.val();

		switch(outputType){
			case "page":
				$textArea.attr("disabled", "");
				break;
			case "template":
				$textArea.removeAttr("disabled");
				break;
		}
	}

	function allowTabIndentation(event){

		if(event.keyCode === 9) {

			var 
				textArea = event.target,
				$textArea = $(textArea),
				start = textArea.selectionStart;
				end = textArea.selectionEnd,
				value = $textArea.val();

		    $textArea.val(value.substring(0, start)
		                + "\t"
		                + value.substring(end));

		    textArea.selectionStart = textArea.selectionEnd = start + 1;

		    event.preventDefault();
		}
	}

	function keyboardShortcuts(event){

		switch(event.keyCode){
			case 116:
				nwin.reloadDev();
				event.preventDefault();
				break;
			case 123:
				nwin.showDevTools();
				event.preventDefault();
				break;
		}
	}

	function readInput(event) {

		event.preventDefault();

		if(working)
			return;

		working = true;

		clearProgressList();

		$("input[name='sourceDir']")
			.val($("input[name='sourceDirDialog']").val());

		$("input[name='destDir']")
			.val($("input[name='destDirDialog']").val());

		input = $form.serializeJSON();

		setTimeout(function(){
			readDirRecursively("");
		}, 500);
	}

	function readDirRecursively(path) {

		FS.readdir(Path.join(input.sourceDir, path), function(err, contents){
			itemsRemaining = contents.length;
			contents.forEach(function(content){

				var tempPath = "",
					readPath = "",
					writePath = "";

				tempPath = Path.join(path, content);
				readPath = Path.join(input.sourceDir, tempPath);			
				FS.stat(readPath, function(err, stats){
					if(stats.isDirectory()){
						itemsRemaining--;
						readDirRecursively(tempPath);
					}
					else if(stats.isFile() &&
						Path.extname(readPath) === ".html"){
						writePath = Path.join(input.destDir, tempPath);						
						processFile(readPath, writePath, tempPath);
					}
				});				
			});
		});
	}

	function processFile(readPath, writePath, relativePath) {

		var uuid = UUID.v1();
		addNewItemToProgressList(relativePath, uuid);

		FS.readFile(readPath, {
			encoding: "utf8"
		}, function (err, fileContents) {
			var variables = [],
				output = "",
				$ = Cheerio.load(fileContents,{
					lowerCaseAttributeNames: false,
					lowerCaseTags: false,
					decodeEntities: false
				});
			
			extractVariables($, variables);
			performReplacements($, variables);

			if(input.output.type === "template")
				output = outputTemplate(variables);
			else if(input.output.type === "page")
				output = $.html();
			
			output = HTMLBeautify(output);

			FS.outputFile(writePath, output, "utf8", function(err){
				completeItemInProgressList(uuid);
				itemsRemaining--;
				if(itemsRemaining === 0)
					working = false;
			});
		});
	}

	function extractVariables($, variables) {		

		input.getters.forEach(function (getter){
			var $element = $(getter.selector);
			if($element.length>0){
				getter.props.forEach(function(prop){
					var variable;
					switch(prop.type){
						case "outerhtml":
							variable = $.html($element);
							break;
						case "innerhtml":
							variable = $element.html();
							break;
						case "text":
							variable = $element.text();
							break;
						case "all-attrs":
							var 
								attrsObj = $element.attr(),
								attrs = "";
							for(var key in attrsObj){
								if(attrsObj.hasOwnProperty(key)){
									if(attrs !== "")
										attrs += " ";
									attrs += key + "=\"" + attrsObj[key] + "\"";
								}
							}
							variable = attrs;
							break;
						case "all-classes":
							variable = $element.attr("class");
							break;
						case "attr":
							variable = $element.attr(prop.name);
							break;
					}
					if(variable)
						variables[prop.variable] = variable;
				});
			}
		});
	}

	function performReplacements($, variables){

		input.setters.forEach(function (setter){
			var $element = $(setter.selector);
			if($element.length>0){
				$element.replaceWith(Mustache.render(setter.replacer,variables));
			}
		});
	}

	function outputTemplate(variables){
		return Mustache.render(input.output.template, variables);
	}

	function clearProgressList(){
		$progressList.empty();
	}

	function addNewItemToProgressList(item, uuid){

		var $newItem = $('<li id="' + uuid + '" class="list-group-item list-group-item-danger">')
			.text(item);

		$progressList.append($newItem);
	}

	function completeItemInProgressList(uuid){
		$progressList.find("li#" + uuid)
			.removeClass("list-group-item-danger")
			.addClass("list-group-item-success");
	}
}

try{
	new Transformer();
}
catch(err){
	console.error(err.stack);
}