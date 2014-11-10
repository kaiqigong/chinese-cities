var curl        = require('node-curl')
, htmlparser2 = require('htmlparser2')
, fs          = require('fs')
,_            = require('lodash')
, url         = require('url');


var indexUrl = "http://www.stats.gov.cn/tjsj/tjbz/xzqhdm/";
// file path and base name
var file = process.argv[2];

console.log('http get: ' + indexUrl);

curl(indexUrl, function (err) {
  if (err) {
    console.error("error: " + err);
    return;
  }
  
  var ulMatched = false;
  var detailUrl = '';
  var parser = new htmlparser2.Parser({
    onopentag: function (name, attrs) {
      if (!ulMatched) {
        ulMatched = (name == 'ul' && typeof(attrs.class) != 'undefined' && attrs.class.indexOf('center_list_contlist') !== -1);
      }
      if (!detailUrl && ulMatched && name == 'a') {
        detailUrl = attrs.href;
      }
    },
    onclosetag: function (name) {
      if (name == 'ul') {
        ulMatched = false;
      }
    }
  });
  parser.write(this.body);
  parser.end();

  detailUrl = url.resolve(indexUrl, detailUrl);
  build(detailUrl);
});

function build (url) {
  console.log('http get: ' + url);

  curl(url, function (err) {
    if (err) {
      console.error("error: " + err);
      return;
    }

    var provinces = [];
    var cities  = [];
    var counties  = [];
    var matched = false;
    var parser = new htmlparser2.Parser({
      onopentag: function(name, attrs){
        matched = (name == 'p' && typeof(attrs.class) != 'undefined' && attrs.class.indexOf('MsoNormal') !== -1);
      },
      ontext: function(text){
        if (matched) {
          text = text.replace(/&nbsp;/g, " ").trim();
          var id = text.substr(0, 6);
          var name = text.substr(6).trim();
          var levels = [id.substr(0, 2), id.substr(2, 2), id.substr(4)];
          if (id.substr(2) == '0000') {
            provinces.push({name:name, id: id});
          } else if (id.substr(4, 2) == '00') {
            if (! cities[provinces.length - 1]) {
              cities[provinces.length - 1] = [];
            }
            cities[provinces.length - 1].push({name:name, id: id});
          } else if (id) {
            if (! counties[provinces.length - 1]) {
              counties[provinces.length - 1] = [];
            }
            if (! counties[provinces.length - 1][cities[provinces.length - 1].length - 1]) {
              counties[provinces.length - 1][cities[provinces.length - 1].length - 1] = [];
            }
            counties[provinces.length - 1][cities[provinces.length - 1].length - 1].push({name:name, id: id});
          }
        }
      },
      onclosetag: function(tagname){
        matched = false;
      }
    });
  parser.write(this.body);
  parser.end();

  if (provinces.length == 0 || cities.length == 0 || counties.length == 0) {
    console.error("error: no data");
    return;
  }

  // write common js
  fs.writeFile('index.js', 
    "var data = " + JSON.stringify([provinces, cities, counties], null, '\t') + ";\n" +
    "exports = data;",
    function (err) {
      if (err) {
        console.error('output file error: ' + file + 'index.js');
      } else {
        console.log('output file: ' + file + 'index.js');
      }
    });
  });
}
