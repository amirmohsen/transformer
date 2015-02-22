var
FS = require("fs-extra"),
Cheerio = require("cheerio"),
JSBeautify = require("js-beautify"),
Mustache = require("mustache"),
ReverseMustache = require("reverse-mustache"),
Path = require("path"),
ngui = require('nw.gui'),
nwin = ngui.Window.get();

function Transformer () {

	var 
	$form = $("#transformer-form"),
	$dirInputs = $("input[type='file']"),
	templates = {},
	input = {},
	map = [],
	variables = [],
	indices = {
		"getter-fields": 0
	};
	
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
		$("div.tf-getters").html( Mustache.render(
			templates["getter-fields"], { index: indices["getter-fields"] }) );
		indices["getter-fields"]++;
	}

	function listen () {

		$("body").on("click", "button.row-creation", addAndRemoveRows);

		// $form.submit(readInput);
	}

	function addAndRemoveRows(event){
		var action, name, buttonName, $button, $currentFields, $newFields;

		$button = $(event.target);
		action = $button.attr("data-action");
		name = $button.attr("data-name");

		$currentFields = $button.closest("div." + name);

		if(action === "remove"){
			if($("div." + name).length > 1)
				$currentFields.remove();
			return;
		}

		$newFields = $( Mustache.render(
			templates[name], { index: indices[name] }) );

		$newFields.insertAfter($currentFields);
		indices[name]++;
	}

	function readInput(event) {
		event.preventDefault();
		input = $form.serializeJSON();
		$dirInputs.each(function(){
			var $input = $(this);
			input[$input.attr("name")] = $input.val();
		});
		serializeDOM();
		console.log(map);
		readDirRecursively("");
	}

	function serializeDOM() {
		var allNodes = $(input.inputTemplate).get();
		map = [];

		walkTheDom(allNodes, map);

		function walkTheDom (nodeList, map) {
			for(var i=0; i<nodeList.length; i++){
				var nodeEntry = captureNode(nodeList[i]);
				if(nodeEntry)
					map.push(nodeEntry);
			}
		}

		function captureNode (node) {
			var nodeEntry;
			if(node.nodeName==="#text"){
				var val = node.nodeValue.trim();
				if(!val)
					return;
				nodeEntry = {
					name: node.nodeName,
					value: val
				};
			}
			else{
				var classes = [], attrs = [];
				
				for(var i=0; i<node.classList.length; i++)
					classes.push(node.classList.item(i));

				for(var i=0; i<node.attributes.length; i++){
					if(node.attributes[i].name!=="class"){
						attrs[i] = {
							name: node.attributes[i].name,
							value: node.attributes[i].value
						}
					}
				}

				nodeEntry = {
					name: node.nodeName,
					classes: classes,
					attrs: attrs,
					nodes: []
				};
				walkTheDom(node.childNodes, nodeEntry.nodes);
			}
			return nodeEntry;
		}
	}

	function readDirRecursively(path) {

		var 
		contents = FS.readdirSync(Path.join(input.sourceDir, path)),
		tempPath = "",
		readPath = "",
		writePath = "",
		stats = null;

		contents.forEach(function(content){
			tempPath = Path.join(path, content);
			readPath = Path.join(input.sourceDir, tempPath);			
			stats = FS.statSync(readPath);

			if(stats.isDirectory())
				readDirRecursively(tempPath);
			else if(stats.isFile() &&
				Path.extname(readPath) === ".html"){
				writePath = Path.join(input.destDir, tempPath);
			processFile(readPath, writePath);
		}
	});
	}

	function processFile(readPath, writePath) {
		var fileContents = FS.readFileSync(readPath, {
			encoding: "utf8"
		});

		variables = [];

		// extractVariables(fileContents);
		
		// FS.outputFileSync(writePath, fileContents, "utf8");
	}

	function extractVariables(htmlContent) {
		var $dom = $(htmlContent);

		// function exploreMap($element, plan){
		// 	var $contents = $element.contents();
		// 	for(var i=0; i<nodes.length; i++){
		// 		var $child = .index(i)
		// 		if(nodes[i].name==="#text"){
		// 			var text = $element.text();
		// 			var vars = reverseMustache({
		// 				template: nodes[i].value,
		// 				content: text
		// 			});
		// 			if(vars)
		// 				variables.push.apply(variables, vars);
		// 		}
		// 		else{

		// 		}
		// 	}
		// }

		// function buildSelector(tag, classes, attrs){

		// }

		// return exploreMap($dom, map);
	}
}

try{
	new Transformer();
}
catch(err){
	console.error(err.stack);
}