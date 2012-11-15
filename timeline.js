// vim: set foldmethod=marker :
/**
 * timeline.js
 *
 * @dependency JSDeferred v0.4 <http://cho45.stfuawsc.com/jsdeferred/doc/intro.html>
 * @licence    MIT Licence <http://www.opensource.org/licenses/mit-license.php>
 * @author     sorenariblog[at]google[dot]com <http://kjirou.sakura.ne.jp/mt/>
 */
(function(){
var __classScope__ = this;


if ('Timeline' in __classScope__) {
    alert('timeline.js: `Timeline` is already defined');
    return;
};
if ('Deferred' in __classScope__ === false) {
    alert('timeline.js: Not required JSDeferred as `Deferred` variable name in global scope');
    return;
};


/**
 * Timelineクラス
 */
var cls = function(){

    /** 再生時間(ms) || null=最後のレイヤが終了した時点で終了
        非同期処理の遅延具合では伸びる可能性もあるので
        正確には「最速で再生が終わる時間」という意味 */
    //! deferred.call 済みかどうかが判定できれば、再生時間超過判定とかもできるんだけど
    this._playtime = null;

    /**
     * 各レイヤー開始・終了同期用のDeferredインスタンスマップ
     *
     * '<マイクロ秒文字列>': [<Deferredインスタンス>, ...]
     *
     * - '0' キーフレームは必ず存在する, playtime設定が有る場合は終了時間キーも存在する
     * - 複数Deferredが有る場合は、そのタイミングに複数開始するレイヤーがあるということ
     * - 他のキーは、他から参照された時間のキーのみ存在する
     * - キーフレーム間が狭すぎると再生時間ズレ幅が大きいので注意
     *   100ms目と101ms目に参照すると、実質はブラウザにもよるが 100msと120-30ms になると思う
     */
    this._frames = undefined;

    /** 生成したレイヤーリスト */
    this._layers = undefined;

    /** _prepare時に格納される変数群 */
    this._lastDeferreds = null; // タイムライン終了条件リスト
    this._frameSequences = null; // 配列化して順番を付与した_frames

    /** 全終了時に同期 */
    this._deferred = null;
};


/** 初期化を行う */
cls.prototype._initialize = function(){
    this._frames = {};
    this._layers = [];
    this._lastDeferreds = [];
    this._frameSequences = [];
    this._deferred = new Deferred();
    // 再生時間設定があれば条件の一つとして登録
    if (this._playtime !== null) {
        this._lastDeferreds.push(this._setFrame(this._playtime));
    };
};

/** 新しいレイヤーを生成する */
cls.prototype.createLayer = function(callback){
    var d = new Deferred();
    var layer = new cls.Layer(d);
    layer._timeline = this;
    this._layers.push(layer);
    this._lastDeferreds.push(d);
    if (callback !== undefined) layer.onstart(callback);
    return layer;
};

/** タイムラインにキーフレームを設定し
    時間経過の際に同期するDeferredオブジェクトを返す */
cls.prototype._setFrame = function(ms){
    var msStr = ms.toString();
    var d = new Deferred();
    if (msStr in this._frames) {
        this._frames[msStr].push(d);
    } else {
        this._frames[msStr] = [d];
    };
    return d;
};

/** タイムラインを開始準備をする
    start内で一度しか呼ばないので分ける必要ないが, 動作確認し易い様に分けた */
cls.prototype._prepare = function(){
    var self = this;

    if (cls._keys(this._frames).length === 0) {// タイムラインへの登録が一つもない場合
        throw new Error('Timeline._prepare, not registered layer on timeline');
    };

    // フレーム情報を [[ms, [<d1>,<d2>, ..]], ..] のリストへ変化
    cls._each(this._frames, function(ms, defs){
        self._frameSequences.push([parseInt(ms), defs]);
    });
    self._frameSequences.sort(function(a, b){ return a[0] - b[0] }); // 早い順にソート
};

/** タイムラインを開始する */
cls.prototype.start = function(){
    var self = this;

    this._prepare();

    // レイヤー側を全員待機状態にする
    cls._each(this._layers, function(nouse, layer){
        layer._observe();
    });

    // タイムライン終了を待機状態にする
    Deferred.parallel(this._lastDeferreds).next(function(){
        var result = self._onfinish();
        if (Deferred.isDeferred(result) === true) {
            return result.next(function(){
                self._deferred.call();
            });
        } else {
            self._deferred.call();
        };
    }).error(cls._catchError);

    // タイムラインを開始する
    var preMs = 0; // 前ループのms
    Deferred.loop(this._frameSequences.length, function(idx){
        var absoluteMs = self._frameSequences[idx][0];
        var waitings = self._frameSequences[idx][1];
        // 前ループの時間からの差分を計算する
        var relativeMs = absoluteMs - preMs;
        preMs = absoluteMs;
        return Deferred.wait(parseFloat(relativeMs / 1000)).next(function(){
            cls._each(waitings, function(nouse, _d){
                _d.call();
            });
        });
    }).error(cls._catchError);
};

/** 実行を中断する
    _deferredは自動実行しないので必要ならgetDeferred().call()する */
cls.prototype.cancel = function(){
    cls._each(this._frames, function(nouse, stacks){
        cls._each(stacks, function(nouse, d){
            d.cancel();
        });
    });
    cls._each(this._layers, function(nouse, layer){
        cls._each(layer._startingDeferreds, function(nouse, d){
            d.cancel();
        });
    });
};

/** タイムライン全終了時のイベントハンドラを登録する */
cls.prototype.onfinish = function(callback){
    this._onfinish = callback;
};
cls.prototype._onfinish = function(){};

/** タイムライン全終了時に同期するDeferredインスタンスを返す */
cls.prototype.getDeferred = function(){
    return this._deferred;
};

/** 生成メソッド */
cls._factory = function(playtime){
    var obj = new this();
    if (playtime !== undefined) obj._playtime = playtime;
    obj._initialize();
    return obj;
};
cls.factory = cls._factory;


/**
 * Timeline.Layerクラス
 */
cls.Layer = (function(){
//{{{
    var kls = function(endDeferred){

        /** 所属するタイムライン */
        this._timeline = undefined;

        /** レイヤー開始条件Deferredインスタンスリスト
            監視状態になった後に全てcallされると処理開始 */
        this._startingDeferreds = [];

        /** 監視状態中フラグ */
        this._isObserving = false;

        /** 処理本体までの待ち時間(ms), 0以上の整数 */
        this._waitingTime = 0;

        /** レイヤー終了通知Deferredインスタンスリスト, 終了時に全部をcallする
            生成引数にて、タイムライン全体の終了条件となるものを渡される */
        this._endingDeferreds = [endDeferred];
    };

    /** 開始条件へタイムラインのキーフレームを追加する */
    kls.prototype.on = function(ms){
        if (this._isObserving) {// 待機後追加はNG
            throw new Error('Timeline.Layer.on, invalid situation');
        };
        this._startingDeferreds.push(this._timeline._setFrame(ms));
    };

    /** 開始条件へレイヤー終了を追加する */
    kls.prototype.after = function(layer){
        if (this === layer) {// 自分自身追加はNG
            throw new Error('Timeline.Layer.after, layer after myself');
        };
        if (this._isObserving) {// 待機後追加はNG
            throw new Error('Timeline.Layer.after, invalid situation');
        };
        this._startingDeferreds.push(layer._before());
    };

    /** 終了時に同期するDeferredインスタンスを返す */
    kls.prototype._before = function(){
        if (this._isObserving) {// 待機後追加はNG
            throw new Error('Timeline.Layer.before, invalid situation');
        };
        var d = new Deferred();
        this._endingDeferreds.push(d);
        return d;
    };

    /** 処理本体を始めるまでの待ち時間を設定する
        複数回実行すると加算される, 合計値がマイナスになると指定時エラー */
    kls.prototype.wait = function(ms){
        if (this._isObserving) {// 待機後追加はNG
            throw new Error('Timeline.Layer.wait, invalid situation');
        };
        this._waitingTime += ms;
        if (this._waitingTime < 0) {
            throw new Error('Timeline.Layer.wait, invalid situation, layer waiting time less than 0');
        };
    };

    /** 自分の後に続くレイヤや待ち時間を一括設定する, afterとwaitのショートカット
        最後はレイヤで終わっていないといけない
        @usage .chain([[waitingTime,] layer], ...)
        @example .chain(1000, layer2, layer3, 2000, layer4) */
    kls.prototype.chain = function(/* var args */){
        var args = Array.prototype.slice.apply(arguments);
        if (args.length === 0 || args.length === 1 && typeof args[0] === 'number') {
            throw new Error('Timeline.Layer.chain, invalid parameter');
        };
        // waitingTimeの場合は次に来る引数を先読みして
        // 次もwaitingTimeなら加算し、レイヤならwaitで設定する
        var arg = args.shift();
        if (typeof arg === 'number') {
            if (typeof args[0] === 'number') {
                args[0] += arg;
            } else {
                args[0].wait(arg);
            };
            arguments.callee.apply(this, args);
        // レイヤの場合は、スコープであるレイヤに所属するように設定し
        // 次のレイヤは自分のスコープで実行する
        } else {
            arg.after(this);
            if (args.length > 0) {
                arguments.callee.apply(arg, args);
            };
        };
    };

    /** 開始条件監視状態に入る, この後は開始条件追加不可 */
    kls.prototype._observe = function(){
        var self = this;
        this._isObserving = true;
        if (this._startingDeferreds.length === 0) {// 開始条件がひとつも無いとエラー
            throw new Error('Timeline.Layer._observe, invalid situation, not observable layer existed');
        };
        //! parallel実行後に同期条件を追加できるか試したら出来なかった
        Deferred.parallel(this._startingDeferreds).next(function(){
            // 開始待ち時間が有る場合
            if (self._waitingTime > 0) {
                return Deferred.wait(parseFloat(self._waitingTime / 1000)).next(function(){
                    return self._onstart();
                });
            } else {
                return self._onstart();
            };
        }).next(function(){
            // 終了通知を行う
            cls._each(self._endingDeferreds, function(nouse, _d){
                _d.call();
            });
        }).error(cls._catchError);
    };

    /** 処理本体をコールバック関数で指定する */
    kls.prototype.onstart = function(callback){
        this.__onstart = callback;
    };
    kls.prototype.__onstart = function(){
        // return で Deferredインスタンスを返せばそれに同期する
    };
    kls.prototype._onstart = function(){
        var result = this.__onstart();
        if (Deferred.isDeferred(result) === true) {
            return result;
        } else {
            return Deferred.next();
        };
    };

    return kls;
//}}}
})();


// 定数群
cls.VERSION = '0.2.0';
cls.RELEASED_AT = '2012-05-04 00:00:00';


// 汎用関数群
cls._consoleLog = function(){
    if ('console' in __classScope__ && 'log' in __classScope__.console) {
        try {
            return __classScope__.console.log.apply(__classScope__.console, arguments);
        } catch (err) {// For IE
            var args = Array.prototype.slice.apply(arguments);
            return __classScope__.console.log(args.join(' '));
        };
    };
};
cls._catchError = function(err){
    cls._consoleLog(err);
    return Deferred.next();
};
cls._keys = function(obj){
    var keys = [], k;
    for (k in obj) { keys.push(k) };
    return keys;
};
cls._each = function(obj, callback) {
    var length = obj.length, name;
    if (length === undefined) {
        for (name in obj) {
            if (callback.call(obj[name], name, obj[name]) === false) { break };
        };
    } else {
        var i = 0;
        for ( ; i < length; ) {
            if (callback.call(obj[i], i, obj[i++]) === false) { break };
        };
    };
    return obj;
};


__classScope__['Timeline'] = cls;
})();
