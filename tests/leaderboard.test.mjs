import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isRanked,parseBoard,localBoard,visibleRows,cheer,BOARD_ROWS} from '../.test-build/leaderboard.js';
import {DEFAULTS} from '../.test-build/game.js';
import {BUILD} from '../.test-build/stats.js';

const run=(id,score,minute,extra={})=>({schema:1,id,build:BUILD,outcome:'caught',startedAt:`2026-09-27T10:${String(minute).padStart(2,'0')}:00.000Z`,settings:{...DEFAULTS,seed:minute},score,...extra});
const online=(extra={})=>({source:'gtx',season:'Playtest 6',players:23,rank:4,previousRank:7,best:142,previousBest:120,personalBest:true,entries:[],...extra});

test('only default settings rank, whatever the seed',()=>{
  assert.equal(isRanked({...DEFAULTS,seed:987654},DEFAULTS),true);
  for(const change of [{duration:60},{grid:15},{hopMs:300},{slots:3},{hitRadius:.24},{roadLimit:0},{nodeCount:6},{boostMs:8000},{freezeMs:5000},{boostSpeed:1.5}])
    assert.equal(isRanked({...DEFAULTS,...change},DEFAULTS),false,JSON.stringify(change));
  assert.equal(isRanked({...DEFAULTS,hitRadius:Number('0.1'),boostMs:7*1000},DEFAULTS),true,'URL-parsed defaults still rank');
  assert.equal(isRanked(undefined,DEFAULTS),false);
});

test('the API board is validated and the player row is kept',()=>{
  const board=parseBoard({season:' Playtest 6 ',players:23,rank:12,previous_rank:null,best:98,previous_best:98,personal_best:false,
    entries:[{rank:2,username:'bo',score:180},{rank:1,username:'ada',score:212}],me:{rank:12,username:'tyler',score:98}});
  assert.equal(board.source,'gtx');assert.equal(board.season,'Playtest 6');assert.equal(board.previousRank,null);assert.equal(board.personalBest,false);
  assert.deepEqual(board.entries.map(e=>[e.rank,e.name,e.me]),[[1,'ada',false],[2,'bo',false],[12,'tyler',true]]);
  const inTop=parseBoard({players:2,entries:[{rank:1,username:'tyler',score:50,me:true}],me:{rank:1,username:'tyler',score:50}});
  assert.equal(inTop.entries.length,1,'the player is not listed twice');assert.equal(inTop.season,null);
  for(const bad of [null,'x',{},{players:1},{players:1,entries:[{rank:1,score:3}]},{players:-1,entries:[]},{players:1,entries:[{rank:1.5,username:'a',score:1}]}])
    assert.equal(parseBoard(bad),null,JSON.stringify(bad));
});

test('the device board ranks this build’s completed default runs, ties sharing a rank',()=>{
  const runs=[run('a',40,1),run('b',90,2),run('c',90,3),run('tuned',500,4,{settings:{...DEFAULTS,duration:60}}),run('old',400,5,{build:'P1-playtest-5'}),
    run('quit',300,6,{outcome:'restarted'}),run('now',60,7)];
  const board=localBoard(runs,'now',BUILD,DEFAULTS);
  assert.equal(board.source,'local');assert.equal(board.players,4);
  assert.deepEqual(board.entries.map(e=>[e.rank,e.score,e.me]),[[1,90,false],[1,90,false],[3,60,true],[4,40,false]]);
  assert.equal(board.entries[0].at,runs[1].startedAt,'on a tie the earlier run stays ahead');
  assert.equal(board.rank,3);assert.equal(board.best,90);assert.equal(board.previousBest,90);assert.equal(board.personalBest,false);
  const best=localBoard([...runs,run('top',95,8)],'top',BUILD,DEFAULTS);
  assert.equal(best.personalBest,true);assert.equal(best.previousBest,90);assert.equal(best.rank,1);
  const first=localBoard([run('solo',12,1)],'solo',BUILD,DEFAULTS);
  assert.equal(first.personalBest,true);assert.equal(first.previousBest,null);
  const damaged=localBoard([...runs,{...run('x',999,9),settings:undefined},{...run('y',999,10),startedAt:undefined}],'now',BUILD,DEFAULTS);
  assert.equal(damaged.players,4,'incomplete stored reports are skipped, not thrown on');
  const unranked=localBoard(runs,'tuned',BUILD,DEFAULTS);
  assert.equal(unranked.rank,null);assert.equal(unranked.personalBest,false);assert.ok(!unranked.entries.some(e=>e.me));
});

test('the visible rows show the top and, below it, the player after a gap',()=>{
  const entries=Array.from({length:30},(_,i)=>({rank:i+1,name:`p${i+1}`,score:300-i,me:i===24}));
  const rows=visibleRows({...online(),entries});
  assert.equal(rows.length,BOARD_ROWS);assert.equal(rows[BOARD_ROWS-2],'gap');assert.equal(rows.at(-1).rank,25);
  assert.equal(rows[BOARD_ROWS-3].rank,BOARD_ROWS-2);
  const near=visibleRows({...online(),entries:entries.map((e,i)=>({...e,me:i===9}))});
  assert.ok(!near.includes('gap'),'tenth place fits in the top ten');assert.equal(near.length,BOARD_ROWS);
  assert.deepEqual(visibleRows({...online(),entries:entries.slice(0,3)}).map(r=>r.rank),[1,2,3]);
});

test('every run is cheered, and bigger news gets a bigger cheer',()=>{
  assert.deepEqual(cheer(online({rank:1,previousRank:3,best:212,previousBest:180}),212),{tier:'top',headline:'TOP OF THE BOARD!',detail:'+32 on your best · #1 of 23 · ▲ 2'});
  assert.deepEqual(cheer(online(),142),{tier:'best',headline:'NEW PERSONAL BEST!',detail:'+22 on your best · #4 of 23 · ▲ 3'});
  assert.deepEqual(cheer(online({previousBest:null,previousRank:null,rank:9}),50),{tier:'first',headline:'YOU’RE ON THE BOARD!',detail:'#9 of 23'});
  assert.deepEqual(cheer(online({personalBest:false,previousRank:4}),142),{tier:'tied',headline:'TIED YOUR BEST!',detail:'Your best: 142 · #4 of 23'});
  assert.deepEqual(cheer(online({personalBest:false,previousRank:4}),130),{tier:'close',headline:'SO CLOSE!',detail:'12 short of your best · #4 of 23'});
  const plain=cheer(online({personalBest:false,previousRank:4}),60);
  assert.equal(plain.tier,'run');assert.equal(plain.detail,'Your best: 142 · #4 of 23');assert.match(plain.headline,/!$/);
  assert.equal(cheer(online({rank:1,players:1,previousBest:null,previousRank:null}),20).tier,'first','alone at the top is not a win over anyone');
  const local={source:'local',season:null,players:5,rank:1,previousRank:null,best:95,previousBest:90,personalBest:true,entries:[]};
  assert.deepEqual(cheer(local,95),{tier:'best',headline:'NEW PERSONAL BEST!',detail:'+5 on your best on this device'});
  assert.deepEqual(cheer({...local,previousBest:null},95),{tier:'first',headline:'FIRST RANKED RUN!',detail:'Your first on this device'});
  assert.deepEqual(cheer({...local,personalBest:false,rank:3},40),{tier:'run',headline:cheer(null,40).headline,detail:'Your best on this device: 95'});
  assert.equal(cheer(null,0).tier,'tuned');assert.equal(cheer(null,0).detail,'Tuned run · not ranked');
});
