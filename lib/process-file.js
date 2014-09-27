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

/*

  Determine whether a token is a Level-2 heading
  ----

  Inputs:
  - MarkdownToken

  Output: boolean

*/
function isLevel2Heading (token) {
  return token.type === 'heading' && token.depth === 2;
}

/*

  Find all Level-2 headings
  ----

  Inputs:
  - MarkdownToken[]

  Output: string[]

*/
function getSubheadings (comments) {
  var tokens = _.flatten(comments.map(function (comment) {
    return comment.tokens.filter(isLevel2Heading);
  }));

  return _.pluck(tokens, 'text');
}

/*

  Find document links in comments
  ----

  - linking to a level-1 heading: `[[Docs]]`.  Renders as [Docs](#docs).
  - linking to a level-2 heading: `[[Docs][How are docs generated?]]`. Renders as [Docs&rarr;How are docs generated?](#docs:how-are-docs-generated)
  - `[[.][How are docs generated?]]` is a relative link to a level-2 heading within the current level-1 section. Renders as [&rarr;How are docs generated?](#docs:how-are-docs-generated)

  Inputs:
  - MarkdownToken[]

  Output: string[]

*/
function getDocLinks (comments) {
  var linkRule = /\[\[[^\]]+\]\]/g;
  return _.flatten(comments.map(function (comment) {
    return comment.tokens.map(function (token) {
      var text = token.text;
      if (!text) { return null; }

      var matches = token.text.match(linkRule);
      return matches && matches.map(function (link) {
        return link.replace(/[\[\]]/g, '');
      });
    }).filter(Boolean);
  }));
}

function processJsFile (filename, src, callback) {
  var docItems = findComments(src);
  if (!docItems.length) { return callback(null, null); }

  callback(null, {
    filename: filename,
    heading: docItems[0].tokens[0].text,
    comments: docItems,
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

/*

  Module interface
  ----

  Inputs:
  - filename: string
  - callback: function (error | null, FileInfo)

*/
module.exports = function processFile (filename, callback) {
  fs.readFile(filename, 'utf8', function (err, src) {
    if (err) { return callback(err); }

    var ext = path.extname(filename);
    switch (ext) {
    case '.js':
      processJsFile(filename, src, callback);
      break;

    case '.md':
    case '.markdown':
      processMarkdownFile(filename, src, callback);
      break;

    default:
      return callback(new Error('Unsupported file type: ' + filename));
    }
  });
};