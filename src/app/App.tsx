import { useEffect, useMemo, useState } from 'react';
import styles from './App.module.scss';

type Tab = 'mine' | 'tasks' | 'miners' | 'friends' | 'profile';
type TelegramUser = { id?: number };
type TelegramWindow = Window & { Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramUser; start_param?: string } } } };
type Referral = { telegram_id: string; created_at?: string };

const FALLBACK_ID = 5143230997;
const STORAGE_KEY = 'agenb-mining-state';
const BOT_NAME = import.meta.env.VITE_BOT_USERNAME || 'YOUR_BOT_USERNAME';
const levels = Array.from({ length: 12 }, (_, index) => ({ level: index + 1, rate: 0.05 * (index + 1), price: index === 0 ? 0 : 0.25 * index }));
const tasks = [
  { icon: '𝕏', title: 'Follow us on X', reward: 50, action: 'Follow' },
  { icon: '▶', title: 'Watch our YouTube', reward: 0.1, action: 'Watch' },
  { icon: '↗', title: 'Visit AGEN website', reward: 0.05, action: 'Visit' },
];

function App() {
  const telegramUser = (window as TelegramWindow).Telegram?.WebApp?.initDataUnsafe?.user;
  const startParam = (window as TelegramWindow).Telegram?.WebApp?.initDataUnsafe?.start_param || new URLSearchParams(window.location.search).get('start') || undefined;
  const userId = telegramUser?.id ?? FALLBACK_ID;
  const [activeTab, setActiveTab] = useState<Tab>('mine');
  const [balance, setBalance] = useState(() => Number(localStorage.getItem(`${STORAGE_KEY}:balance`) ?? 0));
  const [unclaimedBalance, setUnclaimedBalance] = useState(0);
  const [lastClaimTime, setLastClaimTime] = useState(() => Number(localStorage.getItem(`${STORAGE_KEY}:lastClaim`) ?? Date.now()));
  const [level, setLevel] = useState(() => Number(localStorage.getItem(`${STORAGE_KEY}:level`) ?? 1));
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralReward, setReferralReward] = useState(0);
  const [now, setNow] = useState(Date.now());
  const miningRate = levels[level - 1]?.rate ?? 0.05;
  const unclaimed = Math.max(0, unclaimedBalance + ((now - lastClaimTime) / 1000) * miningRate / 3600);
  const totalBalance = balance + unclaimed;
  const formattedBalance = totalBalance.toFixed(4);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}:balance`, String(balance)); localStorage.setItem(`${STORAGE_KEY}:lastClaim`, String(lastClaimTime)); localStorage.setItem(`${STORAGE_KEY}:level`, String(level)); }, [balance, lastClaimTime, level]);
  useEffect(() => {
    fetch('/api/user', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ telegram_id: userId, start_param: startParam }) }).then((response) => response.ok ? response.json() : null).then((user) => {
      if (!user) return;
      setBalance(Number(user.balance));
      setUnclaimedBalance(Number(user.unclaimed_balance));
      setLastClaimTime(Number(user.last_claim_time));
      setLevel(Number(user.mining_level));
      setReferralReward(Number(user.referral_reward));
    }).catch(() => undefined);
    fetch(`/api/referrals/${userId}`).then((response) => response.ok ? response.json() : null).then((data) => data && setReferrals(data.referrals || [])).catch(() => undefined);
  }, [userId, startParam]);

  const claim = () => {
    setBalance(totalBalance);
    setUnclaimedBalance(0);
    setLastClaimTime(Date.now());
    setNow(Date.now());
    fetch('/api/user', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'claim', telegram_id: userId, start_param: startParam }) }).then((response) => response.ok ? response.json() : null).then((user) => { if (!user) return; setBalance(Number(user.balance)); setUnclaimedBalance(Number(user.unclaimed_balance)); setLastClaimTime(Number(user.last_claim_time)); }).catch(() => undefined);
  };
  const buyLevel = (nextLevel: number, price: number) => { if (nextLevel === level + 1 && totalBalance >= price) { setBalance(totalBalance - price); setUnclaimedBalance(0); setLastClaimTime(Date.now()); setLevel(nextLevel); } };
  const claimReferral = () => { fetch(`/api/user/${userId}/referral-claim`, { method: 'POST' }).then((response) => response.ok ? response.json() : null).then((user) => { if (!user) return; setBalance(Number(user.balance)); setReferralReward(Number(user.referral_reward)); }).catch(() => undefined); };
  const referralLink = `https://t.me/${BOT_NAME}?start=${userId}`;
  const pageTitle = useMemo(() => ({ mine: 'Mining', tasks: 'Earn more', miners: 'Miners', friends: 'Friends', profile: 'Profile' }[activeTab]), [activeTab]);

  const renderContent = () => {
    if (activeTab === 'tasks') return <section className={styles.page}><p className={styles.eyebrow}>REWARDS</p><h1>{pageTitle}</h1><p className={styles.muted}>Complete simple actions and grow your balance.</p><div className={styles.taskList}>{tasks.map((task) => { const done = completedTasks.includes(task.title); return <article className={styles.task} key={task.title}><span className={styles.taskIcon}>{task.icon}</span><div><strong>{task.title}</strong><small>+{task.reward} AGEN</small></div><button className={styles.smallButton} disabled={done} onClick={() => setCompletedTasks([...completedTasks, task.title])}>{done ? 'Done' : task.action}</button></article>; })}</div></section>;
    if (activeTab === 'miners') return <section className={styles.page}><p className={styles.eyebrow}>UPGRADE YOUR RATE</p><h1>Mining levels</h1><p className={styles.muted}>Sustainable rates from 0.05 AGEN per hour.</p><div className={styles.levelList}>{levels.map((item) => { const unlocked = item.level <= level; const available = item.level === level + 1; return <article className={`${styles.levelCard} ${unlocked ? styles.unlocked : ''}`} key={item.level}><span className={styles.levelNumber}>{String(item.level).padStart(2, '0')}</span><div><strong>Level {item.level}</strong><small>{item.rate.toFixed(2)} AGEN / hour</small></div><button className={styles.smallButton} disabled={!available} onClick={() => buyLevel(item.level, item.price)}>{unlocked ? 'Active' : available ? `${item.price.toFixed(2)} AGEN` : 'Locked'}</button></article>; })}</div></section>;
    if (activeTab === 'friends') return <section className={styles.page}><p className={styles.eyebrow}>SHARE THE ENERGY</p><h1>Invite friends</h1><p className={styles.muted}>Your Telegram ID: <strong>{userId}</strong></p><div className={styles.referralCard}><span className={styles.referralIcon}>↗</span><strong>Your invite link</strong><div className={styles.linkBox}>{referralLink}</div><button className={styles.goldButton} onClick={() => navigator.clipboard?.writeText(referralLink)}>Copy invite link</button></div><div className={styles.statsRow}><div><strong>{referrals.length}</strong><small>Your Referrals</small></div><div><strong>{referralReward.toFixed(2)}</strong><small>Reward available</small></div></div><div className={styles.referralList}>{referrals.length ? referrals.map((referral) => <div key={referral.telegram_id}><span>Telegram user</span><strong>{referral.telegram_id}</strong></div>) : <p className={styles.muted}>No invitees yet.</p>}</div>{referralReward > 0 && <button className={styles.goldButton} onClick={claimReferral}>Claim referral reward</button>}</section>;
    if (activeTab === 'profile') return <section className={styles.page}><p className={styles.eyebrow}>YOUR ACCOUNT</p><h1>Profile</h1><div className={styles.profileId}><span>Telegram ID</span><strong>{userId}</strong></div><div className={styles.walletCard}><div><small>Main balance / Pool wallet</small><strong>{formattedBalance} <em>AGEN</em></strong></div><div><small>Holding wallet</small><strong>0.0000 <em>AGEN</em></strong></div><div><small>Total supply</small><strong>2B <em>AGEN</em></strong></div><div><small>Community mining allocation</small><strong>1B <em>AGEN</em></strong></div></div><div className={styles.settings}><button onClick={() => setSoundOn(!soundOn)}><span>Sound effects</span><b>{soundOn ? 'On' : 'Off'}</b></button><button><span>Withdrawal</span><b>Coming soon</b></button></div></section>;
    return <section className={styles.page}><div className={styles.mineHeader}><div><p className={styles.eyebrow}>AGEN MINING</p><h1>Mine daily.<br /><span>Grow steadily.</span></h1></div><div className={styles.live}><i /> LIVE</div></div><div className={styles.coinStage}><div className={styles.coinGlow} /><img className={styles.coinImage} src="/coin.png" alt="AGEN coin" /></div><div className={styles.earnings}><small>UNCLAIMED EARNINGS</small><strong>+{unclaimed.toFixed(6)} <em>AGEN</em></strong><span>{miningRate.toFixed(2)} AGEN / hour</span></div><button className={styles.claimButton} onClick={claim}>CLAIM <span>↗</span></button><div className={styles.balanceLine}><span>Main balance</span><strong>{formattedBalance} AGEN</strong></div></section>;
  };

  return (
    <div className={styles.container}>
      <main>{renderContent()}</main>
      <nav className={styles.nav}>{([['mine', '◈', 'Mine'], ['tasks', '✦', 'Tasks'], ['miners', '▣', 'Miners'], ['friends', '↗', 'Friends'], ['profile', '○', 'Profile']] as [Tab, string, string][]).map(([tab, icon, label]) => <button className={activeTab === tab ? styles.navActive : ''} key={tab} onClick={() => setActiveTab(tab)}><span>{icon}</span>{label}</button>)}</nav>
    </div>
  )
}

export default App
