/**
 * MODULE :: CRAWLER
 * --------------------------
 * FUNCTIONS OCRAWL WORDS AND LINKS ON A PAGE
 */
const config = require('../config.json');
const http = require('follow-redirects').http;
const https = require('follow-redirects').https;
const cheerio = require('cheerio');
const StringDecoder = require('string_decoder').StringDecoder;
const model = require('./model');

// EXTRACT ALL LINKS ON A PAGE
module.exports.extractLinks = (link) => {

	return new Promise((resolve, reject) => {

		var decoder = new StringDecoder('utf8');
		(~link.indexOf('http://')?http:https).get(link, (res) => {

		  var linkSet = new Set();
      var data = "";

			res.on('data', (chunk) => {
				console.log(`[debug] ${link}`);   // bug fix, multiple chunks for one website
        data += chunk;
			});

      res.on('end', () => {
        var $ = cheerio.load(decoder.write(data));
				$('a[href]').each((a_i, a) => { linkSet.add((($(a).attr('href').match(/http[s]?:\/\//)?"":link)+$(a).attr('href')).replace(/([^:])\/\//, '$1/').replace(/\/+$/, '')); });
        resolve({
					title: $('title').text() || "",
					url: link.replace(/\/+$/, ''),
					lastModifiedDate: res.headers["last-modified"] && new Date(res.headers["last-modified"]) || new Date(res.headers["date"]),
					lastCrawlDate: new Date(),
					pageSize: res.headers["content-length"] || data.length,
					childLinks: Array.from(linkSet),   // [need review] child link needs to be inserted
          wordFreqTitle: $('title').text()?model.words.wordFreq($('title').text()):{},
					wordFreqBody: $('body').text()?model.words.wordFreq($('body').text()):{},
          wordFreq: $('body, title').text()?model.words.wordFreq($('body, title').text()):{}
				});
      });
		
    }).on('error', (err) => {
			reject(err);
		});

	});
}


// RECURSIVELY EXTRACT LINK
// middleCB: Callback for each successful page crawl
// finalCB: Callback after everything's done
// [TODO: Dance Cycle + Checking last modified date in second, third ... dance before fetching]
module.exports.recursiveExtractLink = (link, middleCB, finalCB) => {
	'use strict';
	var crawledLinks = {}, numCrawled = 0;
	var allPages = []; // object to be written to result.txt
	var _queue = [link];

  var crawlChild = () => {
    while(_queue.length&&crawledLinks[_queue[0]]==true) _queue.shift();   // BFS + Eliminate Cycles
    if(_queue.length&&numCrawled<config.maxPages)
        module.exports.extractLinks(_queue[0]).then((page) => {
          numCrawled++;
          crawledLinks[_queue[0]]=true;
          _queue.shift();
          allPages.push(page);
          page.childLinks.forEach((link) => { _queue.push(link); });

          // Callback
          middleCB(page);

          // recursively call
          crawlChild();
        });
    else if(numCrawled<config.maxPages)
      console.log(`[Error] Cannot retrieve enough pages - current: ${numCrawled}, target: ${config.maxPages}`);
    else finalCB(allPages);
  }

  // initial call
  crawlChild();
}
