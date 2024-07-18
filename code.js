// ==UserScript==
// @name         USST一网畅学题目答案高亮
// @namespace    http://tampermonkey.net/
// @version      2024-07-5
// @description  登录上海理工大学一网畅学系统后，可以自动高亮题目的答案（仅支持填空选择题）
// @author       caodong0225
// @match        https://1906.usst.edu.cn/exam/*
// @icon         https://jwgl.usst.edu.cn/logo/favicon.ico
// @require      https://cdn.jsdelivr.net/npm/json5@2.1.3/dist/index.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Elasticsearch server URL
    const esServerUrl = 'https://frp.caodong0225.top';

    // Username and password for authentication
    const username = 'readdata';
    const password = '123456';
    async function searchAnswer(element,options)
    {
        // 用来检索搜索引擎内部是否存在一样的题目
        const query = {
            query: {
                match: {
                    description: element.innerText, // Replace 'your_field_name' with the actual field name
                }
            },
            size: 5, // Only fetch top 5 matches
            sort: [
                { "_score": { "order": "desc" } } // Sort by score in descending order
            ]
        };

        try {
            const response = await fetch(`${esServerUrl}/description/_search`, { // Replace 'your-index-name' with the actual index name
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + btoa(`${username}:${password}`)
                },
                body: JSON.stringify(query)
            });

            const data = await response.json();
            //console.log(data,data.hits.hits[0]._source,element.innerText);
            // Check if there are hits in the response
            if (data.hits && data.hits.hits.length > 0) {
                var flag = false;
                data.hits.hits.forEach(hit => {
                    if(flag == false){flag = highlightMatchingOptions(hit, element,options)};
                });
            } else {
                console.log('No hits found for the given query.');
            }
        } catch (error) {
            console.error('Elasticsearch query error:', error);
        }
    }

    // Function to log elements' values and perform Elasticsearch queries
    async function logAndQueryElements() {
        /*
        const elements = document.querySelectorAll('.pre-wrap.subject-description.simditor-viewer.mathjax-process');
        for (let element of elements) {
            const value = element.innerText;

            // Perform Elasticsearch query

        }
        */
        //先检查单选题
        const elements = document.querySelectorAll('.subject.ng-pristine.ng-valid.ng-scope.single_selection');
        for (let element of elements) {
            if (!element.classList.contains('processed')) { // 检查是否已经处理过
                // 获取当前父标签的所有子标签
                const childElements = element.querySelectorAll('.pre-wrap.subject-description.simditor-viewer.mathjax-process');
                const childOptions = element.querySelectorAll('.option.ng-scope.vertical');
                // 遍历每一个子标签
                childElements.forEach(child => {
                    //console.log(child.innerText);
                    searchAnswer(child,childOptions);
                });
                // 在元素上添加一个标记类，表示已经处理过
                element.classList.add('processed');
            }
        }
    }

    function extractTextFromHTML(htmlContent) {
        // 创建一个临时的 DOM 元素
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        // 获取纯文本内容（不包含 HTML 标签）
        const textContent = tempDiv.textContent || tempDiv.innerText || '';

        // 返回处理后的文本内容（去除前后空白字符）
        return textContent.trim();
    }

    function highlightMatchingOptions(hit, element,targetOptions) {
        var selectionList = [];
        var optionsSearched;
        var matchFound = false; // 初始化标志变量
        targetOptions.forEach(selections => {
            //selectionList.push(selections.innerText.split(".",2)[1].trim());
            selectionList.push(selections.innerText.substring(3).trim());
        });
        selectionList.sort();
        var searchList = [];
        if (hit._source.options) {
            // Parse the options string into an array of objects
            let tempOptions = hit._source.options.toString();
            const jsonString = tempOptions
            //.replace(/"/g,'')
            //.replace(/'/g, '')
            .replace(/True/g, 'true')
            .replace(/False/g, 'false') ;
            try {
                optionsSearched = JSON5.parse(jsonString);
                optionsSearched.forEach(option => {
                    const text = extractTextFromHTML(option.content);
                    searchList.push(text.trim());
                });

            } catch (error) {
                //console.error('Error parsing options:', jsonString, error);
            }
        }
        searchList.sort();
        if(JSON.stringify(selectionList) === JSON.stringify(searchList))
        {
            //判断是否是同一道题目
            element.style.backgroundColor = 'yellow'; // 设置背景颜色
            targetOptions.forEach(selections => {
                optionsSearched.forEach(opt => {
                    const text = extractTextFromHTML(opt.content);
                    if(selections.innerText.substring(3).trim()==text && opt.is_answer)
                    {
                        selections.style.backgroundColor = 'green';
                        matchFound = true;
                    }
                });
            });
        }
        return matchFound;
    }

    // Run the log and query function immediately
    //logAndQueryElements();

    // Run the log and query function whenever new elements are added to the DOM
    const observer = new MutationObserver(logAndQueryElements);
    observer.observe(document.body, { childList: true, subtree: true });
})();
