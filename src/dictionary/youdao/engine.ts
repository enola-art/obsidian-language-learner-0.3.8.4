// from ext-saladict: https://github.com/crimx/ext-saladict
import { Notice } from "obsidian";
import {
  getText,
  getInnerHTML,
  handleNoResult,
  HTMLString,
  handleNetWorkError,
  DictSearchResult,
  removeChild,
  fetchDirtyDOM
} from '../helpers';

export const getSrcPage = (text: string) =>
  'https://dict.youdao.com/w/' + encodeURIComponent(text.replace(/\s+/g, ' '));

const HOST = 'http://www.youdao.com';

export interface YoudaoResultLex {
  type: 'lex';
  title: string;
  stars: number;
  rank: string;
  pattern: string;
  prons: Array<{
    phsym: string;
    url: string;
  }>;
  basic?: HTMLString;
  collins: Array<{
    title: string;
    content: HTMLString;
  }>;
  discrimination?: HTMLString;
  sentence?: HTMLString;
  translation?: HTMLString;
  wordGroup?: HTMLString;
  relWord?: HTMLString;
}

export interface YoudaoResultRelated {
  type: 'related';
  list: HTMLString;
}

export type YoudaoResult = YoudaoResultLex | YoudaoResultRelated;

type YoudaoSearchResult = DictSearchResult<YoudaoResult>;

export const search = async (
  text: string,
) => {
  //const options = profile.dicts.all.youdao.options
  const options = {
    basic: true,
    collins: true,
    discrimination: true,
    sentence: true,
    translation: true,
    wordGroup: true,
    relWord: true,
  };

  return fetchDirtyDOM(
    'https://dict.youdao.com/w/' + encodeURIComponent(text.replace(/\s+/g, ' '))
  )
    .catch(handleNetWorkError)
    .then(doc => checkResult(doc, options))
    .catch(handleNoResult);
};

/**
 * 轻量查询：仅获取中文基本释义（用于 LearnPanel 自动填充）
 * 比完整 search() 快约 3-5x，跳过柯林斯/例句/辨析等大模块的 DOM 解析
 */
export const searchBasic = async (
  text: string,
): Promise<string> => {
  try {
    const doc = await fetchDirtyDOM(
      'https://dict.youdao.com/w/' + encodeURIComponent(text.replace(/\s+/g, ' '))
    );

    const basicEl = doc.querySelector('#phrsListTab .trans-container');
    if (!basicEl) return "";

    const container = document.createElement('div');
    container.innerHTML = basicEl.innerHTML;
    const lis = container.querySelectorAll('li');
    const meanings: string[] = [];
    const verbFormKeywords = ["复数", "第三人称单数", "现在分词", "过去式", "过去分词"];
    for (const li of lis) {
      const text = li.textContent?.trim() || "";
      const isVerbForm = verbFormKeywords.some(kw => text.includes(kw));
      if (!isVerbForm && text) {
        meanings.push(text);
      }
    }
    return meanings.join("; ");
  } catch (e) {
    return "";
  }
};

function checkResult(
  doc: DocumentFragment,
  options: any,
  transform?: null | ((text: string) => string)
): YoudaoSearchResult | Promise<YoudaoSearchResult> {
  const $typo = doc.querySelector('.error-typo');
  if (!$typo) {
    return handleDOM(doc, options, transform);
  } else if (options.related) {
    return {
      result: {
        type: 'related',
        list: getInnerHTML(HOST, $typo, { transform })
      }
    };
  }
  return handleNoResult();
}

function handleDOM(
  doc: DocumentFragment,
  options: any,
  transform: null | ((text: string) => string)
): YoudaoSearchResult | Promise<YoudaoSearchResult> {
  const result: YoudaoResult = {
    type: 'lex',
    title: getText(doc, '.keyword'),
    stars: 0,
    rank: getText(doc, '.rank'),
    pattern: getText(doc, '.pattern'),
    prons: [],
    collins: [],

  };

  const audio: { uk?: string; us?: string; } = {};

  const $star = doc.querySelector('.star');
  if ($star) {
    result.stars = Number(($star.className.match(/\d+/) || [0])[0]);
  }

  doc.querySelectorAll('.baav .pronounce').forEach($pron => {
    const phsym = $pron.textContent?.trim() || '';
    const $voice = $pron.querySelector<HTMLAnchorElement>('.dictvoice');
    if ($voice?.dataset?.rel) {
      const audioUrl =
        'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent($voice.dataset.rel);

      if (phsym) {
        result.prons.push({ phsym, url: audioUrl });

        if (phsym.includes('英')) {
          audio.uk = audioUrl;
        } else if (phsym.includes('美')) {
          audio.us = audioUrl;
        }
      }
    }
  });

  if (options.basic) {
    result.basic = getInnerHTML(HOST, doc, {
      selector: '#phrsListTab .trans-container',
      transform: beautifyBasicHTML
    });
  }

  if (options.collins) {
    doc.querySelectorAll('#collinsResult .wt-container').forEach($container => {
      const item = { title: '', content: '' };

      const $title = $container.querySelector(':scope > .title.trans-tip');
      if ($title) {
        removeChild($title, '.do-detail');
        item.title = getText($title);
        $title.remove();
      }

      const $star = $container.querySelector('.star');
      if ($star) {
        const starMatch = /star(\d+)/.exec(String($star.className));
        if (starMatch) {
          const rate = +starMatch[1];
          let stars = '';
          for (let i = 0; i < 5; i++) {
            stars += `<svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 426.67 426.67"
              width="1em"
              height="1em"
              style="${i === 4 ? '' : 'margin-right: 1px'}"
            >
              <path
                fill=${i < rate ? '#FAC917' : '#d1d8de'}
                d="M213.33 10.44l65.92 133.58 147.42 21.42L320 269.4l25.17 146.83-131.84-69.32-131.85 69.34 25.2-146.82L0 165.45l147.4-21.42"
              />
            </svg>`;
          }
          $star.innerHTML = stars;
        }
      }

      item.content = getInnerHTML(HOST, $container, { transform });
      if (item.content) {
        result.collins.push(item);
      }
    });
  }

  doc.querySelectorAll("#discriminate .wt-container .title a").forEach((el) => {
    el.remove();
  });
  if (options.discrimination) {
    result.discrimination = getInnerHTML(HOST, doc, {
      selector: '#discriminate',
      transform
    });
  }

  if (options.sentence) {
    result.sentence = getInnerHTML(HOST, doc, {
      selector: '#authority .ol',
      transform
    });
  }

  if (options.translation) {
    result.translation = getInnerHTML(HOST, doc, {
      selector: '#fanyiToggle .trans-container',
      transform
    });
  }

  if (options.wordGroup) {
    result.wordGroup = getInnerHTML(HOST, doc, {
      selector: '#wordGroup',
      transform
    });
  }

  if (options.relWord) {
    result.relWord = getInnerHTML(HOST, doc, {
      selector: '#relWordTab',
      transform
    });
  }
  if (result.title || result.translation) {
    return { result, audio };
  }
  return handleNoResult();
}

/**
 * 美化 basic 部分的 HTML，将动词的各种形式从多行紧凑到一行
 */
function beautifyBasicHTML(html: string): string {
  // 创建临时容器来解析 HTML
  const container = document.createElement('div');
  container.innerHTML = html;

  // 找到包含动词形式的 ul 元素（通常是 <ul> 包含多个 <li>）
  const lists = container.querySelectorAll('ul');
  lists.forEach(ul => {
    const liElements = ul.querySelectorAll('li');
    // 检查这个 ul 是否包含了动词形式（比如有 "第三人称单数" 等文字）
    const hasVerbForms = Array.from(liElements).some(li => 
      li.textContent && (
        li.textContent.includes('第三人称') ||
        li.textContent.includes('现在分词') ||
        li.textContent.includes('过去式') ||
        li.textContent.includes('过去分词')
      )
    );

    if (hasVerbForms) {
      // 创建一个新的更紧凑的容器
      const newSpan = document.createElement('span');
      newSpan.className = 'verb-forms';
      
      // 将所有 li 的内容合并到一个 span 中
      const parts: string[] = [];
      liElements.forEach(li => {
        const text = li.textContent?.trim() || '';
        parts.push(text);
      });
      newSpan.innerHTML = `[ ${parts.join(' ')} ]`;
      
      // 替换原来的 ul
      ul.parentNode?.replaceChild(newSpan, ul);
    }
  });

  return container.innerHTML;
}