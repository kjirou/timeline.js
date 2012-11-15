//あいう
// vim: set foldmethod=marker :

//
// timeline.js のサンプルコード
//
// jQueryも使用しています
//

$(document).ready(function(){

// console.logとほぼ同じ
var consoleLog = Timeline._consoleLog;

//----
// 最も基本的な使い方
$('#basic_usage-1').one('mousedown', function(){

    var timeline = Timeline.factory(5000);

    var layer1 = timeline.createLayer();
    var layer2 = timeline.createLayer();
    var layer3 = timeline.createLayer();

    // on でミリ秒指定で実行する時間を設定
    layer1.on(1000);
    layer2.on(3000);
    layer3.on(3000);

    // start でイベントハンドラを登録
    layer1.onstart(function(){ consoleLog('layer1') });
    layer2.onstart(function(){ consoleLog('layer2') });
    layer3.onstart(function(){ consoleLog('layer3') });

    // タイムライン全終了時のイベントハンドラを登録
    timeline.onfinish(function(){
        consoleLog('Completed timeline');
    });

    consoleLog('Started timeline');
    timeline.start();
});


//----
// 開始条件にレイヤ終了を指定
$('#basic_usage-2').one('mousedown', function(){

    var timeline = Timeline.factory();

    var layer1 = timeline.createLayer();
    var layer2 = timeline.createLayer();
    var layer3 = timeline.createLayer();

    //
    // 以下のようなタイムラインを作る
    // --------
    // 1000ms               => layer1 開始
    // layer1 終了 + 2000ms => layer2 開始
    // layer2 終了 + 3000ms => layer3 開始
    // layer3 終了          => timeline 終了
    // --------
    //

    // after(別レイヤー) で別レイヤー終了を条件に追加する
    // wait(ミリ秒) で処理開始前の待ち時間を設定する
    layer1.on(1000);
    layer2.after(layer1);
    layer2.wait(2000);
    layer3.after(layer2);
    layer3.wait(3000);

    layer1.onstart(function(){ consoleLog('layer1') });
    layer2.onstart(function(){ consoleLog('layer2') });
    layer3.onstart(function(){
        consoleLog('layer3');
        // ちなみにこうすることで
        // 処理*後*に次のレイヤーが始まるまでの間隔を設定できる
        //return Deferred.wait(1.0);
    });

    timeline.onfinish(function(){
        consoleLog('Completed timeline');
    });

    consoleLog('Started timeline');
    timeline.start();
});


//----
// chainを使った一括設定
$('#basic_usage-3').one('mousedown', function(){

    var timeline = Timeline.factory();

    var layer1 = timeline.createLayer();
    var layer2 = timeline.createLayer();
    var layer3 = timeline.createLayer();

    layer1.on(1000);

    // 先の例の.on以外の部分はこのように記述することも出来ます
    layer1.chain(2000, layer2, 3000, layer3);

    // 上記と等価です
    //layer1.chain(1000, 1000, layer2, 1000, 1000, 1000, layer3);

    // 上記と等価です
    //layer1.chain(2000, layer2);
    //layer3.after(layer2);
    //layer3.wait(3000);

    layer1.onstart(function(){ consoleLog('layer1') });
    layer2.onstart(function(){ consoleLog('layer2') });
    layer3.onstart(function(){ consoleLog('layer3') });

    timeline.onfinish(function(){
        consoleLog('Completed timeline');
    });

    consoleLog('Started timeline');
    timeline.start();
});


//----
// 複数レイヤを終了条件へ指定
$('#basic_usage-4').one('mousedown', function(){

    var timeline = Timeline.factory();

    var lastLayer = timeline.createLayer();
    lastLayer.onstart(function(){
        consoleLog('Last layer');
    });

    //
    // ランダムで 0-10秒 に設定される全てのレイヤーが終了しないと
    // lastLayer は実行されない
    //

    var i, layer, wt;
    for (i = 1; i <= 10; i++) {
        layer = timeline.createLayer();
        wt = Math.random() * 10000;
        layer.on(wt);
        (function(i, wt){
            layer.onstart(function(){
                consoleLog('layer' + i + '=' + wt);
            });
        })(i, wt);
        lastLayer.after(layer);
    };

    // Deferredオブジェクトへ直接同期する方法
    timeline.getDeferred().next(function(){
        consoleLog('Completed timeline');
    });

    consoleLog('Started timeline');
    timeline.start();
});


//----
// ありがちな設定間違いとエラー確認
$('#basic_usage-errors').one('mousedown', function(){

    // 最初に開始するレイヤが無い状態, ひとつは layer.on() で登録する必要がある
    var timeline = Timeline.factory();
    var layer1 = timeline.createLayer();
    try {
        timeline.start();
    } catch (err) {
        consoleLog(err);
    };

    // 開始しないレイヤが残っている場合, 最もありがち
    var timeline = Timeline.factory();
    var layer1 = timeline.createLayer();
    var layer2 = timeline.createLayer();
    layer1.on(1);
    // layer2 が未登録のまま
    try {
        timeline.start();
    } catch (err) {
        consoleLog(err);
    };

    //
    // ! レイヤ同士をデッドロック的に設定してしまった場合のエラーには未対応 !
    //
});


//----
// レイヤ内で終了を遅延させる
$('#with_jsdeferred-1').one('mousedown', function(){

    var timeline = Timeline.factory();
    var layer = timeline.createLayer();

    layer.on(1000);

    layer.onstart(function(){
        consoleLog('layer.onstart');
        return Deferred.wait(1.0); // レイヤ実行後に待機時間を入れる
    });

    timeline.onfinish(function(){
        consoleLog('timeline.onfinish');
        return Deferred.wait(1.0); // タイムライン実行後に待機時間を入れる
    });

    timeline.getDeferred().next(function(){
        consoleLog('deferred');
    });

    consoleLog('Started timeline');
    timeline.start();
});


//----
// 複数のタイムラインを同期
$('#with_jsdeferred-2').one('mousedown', function(){

    var timelines = [];
    var i;
    for (i = 0; i < 5; i++) {
        (function(i){
            var timeline = Timeline.factory();
            var layer = timeline.createLayer();
            var wt = Math.random() * 4000 + 1000; // 1-5秒
            layer.on(wt)
            timeline.onfinish(function(){ consoleLog('timeline[' + i + ']=', wt) });
            timelines.push(timeline)
        })(i);
    };

    var deferreds = [];
    for (i = 0; i < timelines.length; i++) {
        deferreds.push(timelines[i].getDeferred());
    };

    Deferred.parallel(deferreds).next(function(){
        consoleLog('Completed timelines');
    }).error(function(err){consoleLog(err)});

    consoleLog('Started timelines');
    for (i = 0; i < timelines.length; i++) { timelines[i].start() };
});


//----
// 謎の利用例
$('#demo-nazo').one('mousedown', function(){

    var timeline = Timeline.factory();

    var extent = 20;
    var size = 20;
    var boxes = [];
    var rowIndex = 0;
    var columnIndex = 0;
    var indexes = [];

    // 二次元配列と二次元配列インデックスを直列化した配列を生成
    for (; rowIndex < extent; rowIndex++) {
        boxes[rowIndex] = [];
        columnIndex = 0;
        for (; columnIndex < extent; columnIndex++) {
            indexes.push([rowIndex, columnIndex]);
        };
    };

    // 土台
    var base = $('<div />').css({
        position: 'absolute',
        top: 300,
        left: 10,
        width: size * extent,
        height: size * extent,
        zIndex: 1
    }).appendTo(document.body);

    // 土台にマス群を配置してレイヤーを関連付け
    var i;
    for (i = 0; i < indexes.length; i++) {
        (function(ri, ci){

            var jq = $('<div />')
                .css({
                    position: 'absolute',
                    top: size * ri,
                    left: size * ci,
                    width: size,
                    height: size,
                    backgroundColor: '#0000FF'
                })
                .appendTo(base)
            ;

            var layer = timeline.createLayer();

            layer.onstart(function(){
                var d = new Deferred;
                jq.animate({
                    opacity: 0.0
                }, {
                    duration: Math.random() * 500 + 200,
                    complete: function(){
                        d.call();
                    }
                });
                return d;
            });

            jq._layer_ = layer; // 面倒なんでjQueryの中に保持

            boxes[ri][ci] = jq;

        })(indexes[i][0], indexes[i][1]);
    };

    // レイヤ関連付け
    for (i = 0; i < indexes.length; i++) {
        (function(ri, ci){

            // 上のボックスが消えたら開始という条件
            if (boxes[ri - 1] !== undefined) {
                boxes[ri][ci]._layer_.after(boxes[ri - 1][ci]._layer_);
            };

            // 左のボックスが消えたら開始という条件
            if (boxes[ri][ci - 1] !== undefined) {
                boxes[ri][ci]._layer_.after(boxes[ri][ci - 1]._layer_);
            };

        })(indexes[i][0], indexes[i][1]);
    };

    // 最左上から開始
    boxes[0][0]._layer_.on(1000);

    timeline.onfinish(function(){
        base.remove();
        consoleLog('Completed collapsing');
    });

    consoleLog('Started collapsing');
    timeline.start();
});


//----
// 昔の2D-RPGゲームムービー的利用例
$('#demo-movie').one('mousedown', function(){

    var timeline = Timeline.factory();

    var createJQueryObject = function(width, height){
        return $('<div />').css({
            position: 'absolute',
            top: 0,
            left: 0,
            width: width,
            height: height
        });
    };

    // 画面
    var screen = createJQueryObject(400, 300)
        .css({
            top: 300,
            left: 10,
            border: '3px solid #CCC',
            overflow: 'hidden'
        })
        .appendTo($(document.body))
    ;

    // 背景
    var bg = createJQueryObject(400, 600)
        .css({
            backgroundColor: '#FFF'
        })
        .appendTo(screen)
    ;

    // テキスト
    var text = createJQueryObject(400, 60)
        .html('背景が流れると共に<br />テキストが表示されて・・・')
        .css({
            top: 20,
            fontSize: 15,
            lineHeight: '30px',
            textAlign: 'center'
        })
        .hide()
        .appendTo(screen)
    ;

    // アクター
    var actor = createJQueryObject(32, 32)
        .css({
            top: 300,
            left: 184,
            fontSize: 9,
            backgroundColor: '#FF0000'
        })
        .text('キャラ')
        .appendTo(bg)
    ;

    // アクター大
    var largeActor = createJQueryObject(100, 200)
        .css({
            top: 100,
            left: 10,
            fontSize: 12,
            backgroundColor: '#FF9933'
        })
        .text('キャラが拡大表示されて・・・')
        .hide()
        .appendTo(screen)
    ;

    // 会話ウィンドウ
    var talkWindow = createJQueryObject(300, 80)
        .css({
            top: 210,
            left: 60,
            fontSize: 15,
            fontWeight: 'bold',
            color: '#FFF',
            backgroundColor: '#0000FF'
        })
        .text('なんかしゃべりだして・・・')
        .hide()
        .appendTo(screen)
    ;


    // 背景が流れるアニメーション
    var moveBg = timeline.createLayer();
    moveBg.onstart(function(){
        var d = new Deferred();
        bg.animate({
            top: -150
        }, {
            duration: 5000,
            easing: 'linear',
            complete: function(){ d.call() }
        });
        return d;
    });

    // テキスト１がフェードイン/アウトするアニメーション
    var fadeInText = timeline.createLayer();
    fadeInText.onstart(function(){
        var d = new Deferred();
        text.fadeIn(3000, function(){
            d.call();
        });
        return d;
    });
    var fadeOutText = timeline.createLayer();
    fadeOutText.onstart(function(){
        var d = new Deferred();
        text.fadeOut(3000, function(){
            d.call();
        });
        return d;
    });

    // キャラがフェードインするアニメーション
    var fadeInLargeActor = timeline.createLayer();
    fadeInLargeActor.onstart(function(){
        var d = new Deferred();
        largeActor.fadeIn(3000, function(){
            d.call();
        });
        return d;
    });

    // 会話ウィンドウがフェードインするアニメーション
    var fadeInTalkWindow = timeline.createLayer();
    fadeInTalkWindow.onstart(function(){
        var d = new Deferred();
        talkWindow.fadeIn(3000, function(){
            d.call();
        });
        return d;
    });

    // 会話追加アニメーション
    var addTalk1 = timeline.createLayer();
    addTalk1.onstart(function(){
        talkWindow.text('しゃべり終わったら・・・');
    });
    var addTalk2 = timeline.createLayer();
    addTalk2.onstart(function(){
        talkWindow.text('終了');
        return Deferred.wait(1.0);
    });


    // タイムライン作成
    moveBg.on(1000);
    fadeInText.on(1000);
    fadeInText.chain(2000, fadeOutText, fadeInLargeActor, fadeInTalkWindow,
        1000, addTalk1, 2000, addTalk2);


    // 実行
    timeline.onfinish(function(){
        screen.fadeOut(2000, function(){
            screen.remove();
        });
        consoleLog('Completed movie');
    });

    consoleLog('Started movie');
    timeline.start();

});


});
