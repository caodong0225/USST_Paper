// ==UserScript==
// @name         USST一网畅学题目答案高亮
// @namespace    http://tampermonkey.net/
// @version      2024-07-22
// @description  登录上海理工大学一网畅学系统后，可以自动高亮题目的答案（仅支持填空选择题）
// @author       caodong0225
// @match        https://1906.usst.edu.cn/exam/*
// @icon         https://jwgl.usst.edu.cn/logo/favicon.ico
// @require      https://cdn.bootcdn.net/ajax/libs/json5/2.2.3/index.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Elasticsearch server URL
    const esServerUrl = 'https://frp.caodong0225.top';

    // Username and password for authentication
    const username = 'readdata';
    const password = '123456';
    async function searchAnswer(element,options,isSelection)
    {
        // 用来检索搜索引擎内部是否存在一样的题目
        const query = {
            query: {
                match: {
                    description: element.innerText, // 替换为模板字段
                }
            },
            size: 5, // 只检索匹配度最高的5个结果
            sort: [
                { "_score": { "order": "desc" } } // 按照匹配分数从高到低排序
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
                if(isSelection)//判断是否是选择题
                {
                    let flag = false;
                    data.hits.hits.forEach(hit => {
                        if (flag === false) {
                            flag = highlightMatchingOptions(hit, element, options)
                        }
                        ;
                    });
                }else{
                    let answers = "";
                    const correct_answers = JSON5.parse(data.hits.hits[0]._source.correct_answers);
                    correct_answers.forEach(answer => {
                        const text = answer.content;
                        answers += text + " ";
                    });
                    //高亮显示答案
                    element.style.backgroundColor = 'yellow'; // 设置背景颜色
                    //添加标签，显示答案为绿色
                    element.innerHTML += "<span style='color:green'>答案："+answers+"</span>";
                }
            } else {
                console.log('No hits found for the given query.');
            }
        } catch (error) {
            console.error('Elasticsearch query error:', error);
        }
    }

    // Function to log elements' values and perform Elasticsearch queries
    async function logAndQueryElements() {
        //先检查单选题和判断题
        const elements_single = document.querySelectorAll('.subject.ng-pristine.ng-valid.ng-scope.single_selection');
        const elements_judge = document.querySelectorAll('.subject.ng-pristine.ng-valid.ng-scope.true_or_false');
        const elements_multi = document.querySelectorAll('.subject.ng-pristine.ng-valid.ng-scope.multiple_selection');
        //合并两个数组
        const elements = Array.from(elements_single).concat(Array.from(elements_judge)).concat(Array.from(elements_multi));
        for (let element of elements) {
            if (!element.classList.contains('processed')) { // 检查是否已经处理过
                // 获取当前父标签的所有子标签
                const childElements = element.querySelectorAll('.pre-wrap.subject-description.simditor-viewer.mathjax-process');
                const childOptions = element.querySelectorAll('.option.ng-scope.vertical');
                // 遍历每一个子标签
                childElements.forEach(child => {
                    //console.log(child.innerText);
                    searchAnswer(child,childOptions,true);
                });
                // 在元素上添加一个标记类，表示已经处理过
                element.classList.add('processed');
            }
        }
        const elements_fill = document.querySelectorAll('.subject.ng-pristine.ng-valid.ng-scope.fill_in_blank');
        for (let element of elements_fill) {
            if (!element.classList.contains('processed')) { // 检查是否已经处理过
                // 获取当前父标签的所有子标签
                const childElements = element.querySelectorAll('.pre-wrap.subject-description.simditor-viewer.mathjax-process');
                childElements.forEach(child => {
                    searchAnswer(child,null,false);
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
        const selectionList = [];
        let optionsSearched;
        let matchFound = false; // 初始化标志变量
        targetOptions.forEach(selections => {
            //selectionList.push(selections.innerText.split(".",2)[1].trim());
            selectionList.push(selections.innerText.substring(3).trim());
        });
        selectionList.sort();
        const searchList = [];
        if (hit._source.options) {
            // Parse the options string into an array of objects
            let tempOptions = hit._source.options.toString();
            const jsonString = tempOptions
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
                    if(selections.innerText.substring(3).trim()===text && opt.is_answer)
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
