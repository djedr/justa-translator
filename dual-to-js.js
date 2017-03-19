const parse = require('../dj-parser/parse.js');

// note: { operator } shouldn't be named that
// todo: rewrite the whole thing, only keep the correct ideas
function translate_(tree, world) {
    const retExpr = {};
    console.log('tree', tree);
    if (tree.text) { // word
        console.log('text', tree.text);
        retExpr.rep = tree.text;
        return { operator: tree.text, expr: retExpr };
        throw Error('reference error: ' + tree.text);
    } else {
        let { operator, expr } = translate(tree[0], world);

        if (operator === 'lambda') {
            retExpr.type = '=>';

            console.log('translating tree@1');
            let { operator: child1, expr: expr1 } = translate(tree[1]);

            if (child1 === 'in') {
                retExpr.input = expr1;
            }

            console.log('translating tree@2');
            let { operator: child2, expr: expr2 } = translate(tree[2]);

            if (child2 === 'out') {
                retExpr.output = expr2;
            }

            retExpr.rep = retExpr.input.rep + ' => ' + retExpr.output.rep;

            // todo: what kind of hack is this?
            operator = '';
        } else if (operator === 'in') {
            retExpr.type = 'input';
            retExpr.value = tree.slice(1).map(translate);
            console.log(retExpr.value);
            let argsRep = '';
            retExpr.value.slice(0, -1).forEach(({operator, expr}) => argsRep += expr.rep + ', ');
            retExpr.value.slice(-1).forEach(({operator, expr}) => argsRep += expr.rep);
            retExpr.rep = '(' + argsRep + ')';
        } else if (operator === 'out') {
            retExpr.type = 'output';
            retExpr.value = tree.slice(1).map(translate);
            let outRep = '';
            retExpr.value.slice(0, -1).forEach(({operator, expr}) => outRep += expr.rep + ', ');
            retExpr.value.slice(-1).forEach(({operator, expr}) => outRep += expr.rep);
            retExpr.rep = '(' + outRep + ')';
        }

        console.log('operator', operator, 'expr', retExpr);
        return { operator, expr: retExpr };

        throw Error('unrecognized operator');

    }
}

const translateWord = ({ text }) => {
    return {
        // word to js mappings
    }[text] || text;
};

const translateList = (list, separator = ',', trailing = false) => {
    let ret = '';

    const translatedList = list.map(translate).map(a => a.translated);
    translatedList.slice(0, -1).forEach(a => ret += `${a}${separator} `);
    translatedList.slice(-1).forEach(a => ret += a + (trailing? separator: ''));

    return ret;
};

const translateLevel0Operation = (operator, args) => {
    let ret = '';

    if (operator === '\\') {
        ret = `${translateList(args, ';', true)}`;
    } else if (operator === 'lambda') {
        const input = translate(args[0]).translated;
        const output = translate(args[1]).translated;

        ret = `(${input}) => (${output})`;
    } else if (operator === '=>') {
        const input = translateList(args);

        ret = `(${input}) => `;
    } else if (operator === 'in') {
        ret = translateList(args);
    } else if (operator === 'out') {
        ret = translateList(args);
    } else if (operator === 'const') {
        const name = translate(args[0]).translated;
        const value = translate(args[1]).translated;

        ret = `const ${name} = ${value}`;
    } else if (operator === '+') {
        const left = translate(args[0]).translated;
        const right = translate(args[1]).translated;

        ret = `${left} + ${right}`;
    } else {
        ret = `${operator}(${translateList(args)})`
        //throw Error('Unrecognized operator: ${operator}!');
    }

    return ret;
};

const translateLevel1Operation = (expr, args) => {
    const { raw: operator, translated } = translate(expr);
    let ret = '';

    if (translated.includes('=>')) {
        ret = translated;
        const output = translate(args[0]).translated;
        ret += `(${output})`;
    } else {
        throw Error('todo');
    }
    return ret;
};


/**
 * input: tree, text;
 * ouput: tree, text;
 * @param {*} tree
 * @param {*} world
 */
const translate = (tree, world) => {
    const ret = { source: tree };
    console.log('tree', tree);
    if (tree.text) { // word
        console.log('text', tree.text);
        ret.text = tree.text;
        ret.translated = translateWord(tree);
        return ret;
        throw Error('reference error: ' + tree.text);
    } else { // operation
        // translate operator
        let { text: operator, translated } = translate(tree[0], world);

        if (operator) { // operator is a word
            ret.translated = translateLevel0Operation(operator, tree.slice(1));
        } else { // operator is not a word
            ret.translated = translateLevel1Operation(tree[0], tree.slice(1));

            //ret.translated = '(' + translated + ')';
        }

        return ret;

        throw Error('unrecognized operator');
    }
}

// todo: properly fold spaces before comparing expected and actual
const testExprs = {
    '': '',
    '=>[x][x]': '(x) => (x);',
    'lambda[in[x] out[x]]': '(x) => (x);',
    'const[x 5]': 'const x = 5;',
    'const[id lambda[in[x] out[x]]]': 'const id = (x) => (x);',
    'const[add lambda[in[x y] out[+[x y]]]]': 'const add = (x, y) => (x + y);',

    [`
      const[add lambda[in[x y] out[+[x y]]]]
      console.log[add[2 2]]
    `]:
      `
      const add = (x, y) => (x + y);
      console.log(add(2, 2));
      `
};

Object.entries(testExprs).forEach(([expr, expected]) => {
    const parsed = parse(expr);
    const actual = translate(parsed).translated;
    console.log('***');
    console.log('Translating:\n', expr);
    console.log('Result:\n', actual);
    console.log('Expected:\n', expected);
    console.log('Success: ', actual.replace(/\s+/gm, ' ').trim() === expected.replace(/\s+/gm, ' ').trim());
    console.log();
});
console.log('END');
