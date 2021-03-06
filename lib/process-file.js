/*

  Process a file
  ====

  To process source files we extract comments and parse as markdown.

  To process markdown files we treat them as one big comment, so that the data format is consistent.

*/

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var findComments = require('./find-comments');
var extractLinks = require('./extract-links');
var isHeading = require('./is-heading');

function getSubheadings (comments) {
  var tokens = _.flatten(comments.map(function (comment) {
    return comment.tokens.filter(isHeading.bind(null, 2));
  }));

  return _.pluck(tokens, 'text');
}

/*

  Find document links in comments
  ----

  Find doc links with [[Extract Document Links]].

*/
function getDocLinks (comments) {
  var links = [];

  comments.forEach(function (comment) {
    return comment.tokens.forEach(function (token) {
      var text = token.text;
      if (!text) { return null; }

      extractLinks(token.text).forEach(function (l) {
        links.push(l);
      });
    });
  });

  return links;
}

function processGenericFile (filename, src, callback) {
  var docItems = findComments(src);
  if (!docItems.length) { return callback(null, null); }

  callback(null, {
    filename: filename,
    heading: docItems[0].tokens[0].text,
    items: docItems,
    subheadings: getSubheadings(docItems),
    links: getDocLinks(docItems)
  });
}

var marked = require('marked');
var excludePreHeadingMarkdownTokens = require('./exclude-pre-heading-markdown-tokens');
function processMarkdownFile (filename, src, callback) {
  var docItems = excludePreHeadingMarkdownTokens([{
    line: 0,
    tokens: marked.lexer(src.trim())
  }]);

  if (!docItems.length) { return callback(null, null); }

  callback(null, {
    filename: filename,
    heading: docItems[0].tokens[0].text,
    items: docItems,
    subheadings: getSubheadings(docItems),
    links: getDocLinks(docItems)
  });
}

module.exports = function processFile (filename, callback) {
  var handlers = [
    {
      ext: ['.md', '.markdown'],
      func: processMarkdownFile
    }
  ];

  fs.readFile(filename, 'utf8', function (err, src) {
    if (err) { return callback(err); }

    var ext = path.extname(filename);
    var i;
    var h;
    for (i=0; i<handlers.length; i+=1) {
      h = handlers[i];
      if (h.ext.indexOf(ext) === -1) { continue; }

      //> run the custom handler
      return h.func(filename, src, callback);
    }

    //> unless a custom handler is found, we'll assume c-style comments
    return processGenericFile(filename, src, callback);
  });
};
