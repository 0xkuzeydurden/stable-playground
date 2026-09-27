import { useEffect, useMemo, useRef, useState } from 'react';
import type { Address } from 'viem';
import { isAddress, parseEther } from 'viem';
import Button from './ui/Button';
import Card from './ui/Card';
import { formatGUSDT, shortenAddress } from './utils/format';
import { toast, useToast } from './toast';
import {
  GM_ABI,
  GM_ADDRESS,
  GN_ABI,
  GN_ADDRESS,
  STABLE,
  addrUrl,
  publicClient,
  txUrl,
  walletClient,
  webSocketClient,
  MINIMAL_ERC20_ABI,
  MINIMAL_ERC20_BYTECODE,
  MINIMAL_ERC721_ABI,
  MINIMAL_ERC721_BYTECODE,
  createBrowserWalletClient,
} from './web3';

const inputClasses =
  'w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-text placeholder:text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus:outline-none focus:ring-2 focus:ring-[#25c279]/60 focus:border-[#25c279]/40 transition-colors';

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong';
};

function App() {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [totalGM, setTotalGM] = useState<bigint | null>(null);
  const [totalGN, setTotalGN] = useState<bigint | null>(null);
  const [userGM, setUserGM] = useState<bigint | null>(null);
  const [userGN, setUserGN] = useState<bigint | null>(null);
  const [gmPending, setGmPending] = useState(false);
  const [gnPending, setGnPending] = useState(false);
  const [transferPending, setTransferPending] = useState(false);
  const [switchPending, setSwitchPending] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [erc20Name, setErc20Name] = useState('');
  const [erc20Symbol, setErc20Symbol] = useState('');
  const [erc721Name, setErc721Name] = useState('');
  const [erc721Symbol, setErc721Symbol] = useState('');
  const [erc20Pending, setErc20Pending] = useState(false);
  const [erc721Pending, setErc721Pending] = useState(false);
  const [recentErc20, setRecentErc20] = useState<Address[]>([]);
  const [recentErc721, setRecentErc721] = useState<Address[]>([]);
  const walletRef = useRef<ReturnType<typeof createBrowserWalletClient>>(walletClient);

  const toastMessage = useToast();
  const hasWallet = Boolean(walletRef.current);
  const onStableChain = chainId === STABLE.id;

  const gmDisabled = !address || !onStableChain || gmPending;
  const gnDisabled = !address || !onStableChain || gnPending;
  const transferDisabled =
    !address || !onStableChain || transferPending || !transferTo || !transferAmount;

  useEffect(() => {
    const client = walletRef.current;
    if (!client) return;
    client
      .getChainId()
      .then(setChainId)
      .catch(() => setChainId(null));

    client
      .getAddresses()
      .then((accounts) => {
        if (accounts[0]) setAddress(accounts[0]);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;
    if (!ethereum) return;
    const handleAccounts = (accounts: string[]) => {
      setAddress(accounts[0] ? (accounts[0] as Address) : null);
    };
    const handleChain = (hexId: string) => {
      setChainId(parseInt(hexId, 16));
    };
    ethereum.on?.('accountsChanged', handleAccounts);
    ethereum.on?.('chainChanged', handleChain);
    return () => {
      ethereum.removeListener?.('accountsChanged', handleAccounts);
      ethereum.removeListener?.('chainChanged', handleChain);
    };
  }, []);

  useEffect(() => {
    let unwatch: (() => void) | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const updateLatest = () => {
      publicClient
        .getBlockNumber()
        .then(setBlockNumber)
        .catch(() => null);
    };

    const startPolling = () => {
      updateLatest();
      interval = setInterval(updateLatest, 5000);
    };

    if (webSocketClient) {
      try {
        unwatch = webSocketClient.watchBlockNumber({
          onBlockNumber: (block) => setBlockNumber(block),
          onError: () => {
            unwatch?.();
            startPolling();
          },
        });
      } catch {
        startPolling();
      }
    } else {
      startPolling();
    }

    updateLatest();

    return () => {
      unwatch?.();
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const refreshTotals = async () => {
      try {
        const [gm, gn] = await Promise.all([
          publicClient.readContract({
            address: GM_ADDRESS,
            abi: GM_ABI,
            functionName: 'totalGM',
          }) as Promise<bigint>,
          publicClient.readContract({
            address: GN_ADDRESS,
            abi: GN_ABI,
            functionName: 'totalGN',
          }) as Promise<bigint>,
        ]);
        setTotalGM(gm);
        setTotalGN(gn);
      } catch (error) {
        console.warn('Failed to load totals', error);
      }
    };
    refreshTotals();
  }, []);

  useEffect(() => {
    if (!address) {
      setBalance(null);
      setUserGM(null);
      setUserGN(null);
      return;
    }
    const refreshAccountData = async () => {
      try {
        const [bal, gm, gn] = await Promise.all([
          publicClient.getBalance({ address }),
          publicClient.readContract({
            address: GM_ADDRESS,
            abi: GM_ABI,
            functionName: 'userGMCount',
            args: [address],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: GN_ADDRESS,
            abi: GN_ABI,
            functionName: 'userGNCount',
            args: [address],
          }) as Promise<bigint>,
        ]);
        setBalance(bal);
        setUserGM(gm);
        setUserGN(gn);
      } catch (error) {
        console.warn('Failed to load account data', error);
      }
    };
    refreshAccountData();
  }, [address, chainId]);

  const refreshCounts = async () => {
    try {
      const [gm, gn] = await Promise.all([
        publicClient.readContract({
          address: GM_ADDRESS,
          abi: GM_ABI,
          functionName: 'totalGM',
        }) as Promise<bigint>,
        publicClient.readContract({
          address: GN_ADDRESS,
          abi: GN_ABI,
          functionName: 'totalGN',
        }) as Promise<bigint>,
      ]);
      setTotalGM(gm);
      setTotalGN(gn);
      if (address) {
        const [gmUser, gnUser] = await Promise.all([
          publicClient.readContract({
            address: GM_ADDRESS,
            abi: GM_ABI,
            functionName: 'userGMCount',
            args: [address],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: GN_ADDRESS,
            abi: GN_ABI,
            functionName: 'userGNCount',
            args: [address],
          }) as Promise<bigint>,
        ]);
        setUserGM(gmUser);
        setUserGN(gnUser);
      }
    } catch (error) {
      console.warn('Failed to refresh counts', error);
    }
  };

  const refreshBalance = async (account: Address) => {
    try {
      const value = await publicClient.getBalance({ address: account });
      setBalance(value);
    } catch (error) {
      console.warn('Failed to refresh balance', error);
    }
  };

  const ensureWallet = () => {
    if (!walletRef.current) {
      toast.show({ type: 'error', text: 'Install MetaMask to continue.' });
      return false;
    }
    return true;
  };

  const connect = async () => {
    if (!ensureWallet()) return;
    try {
      setConnecting(true);
      const client = walletRef.current;
      if (!client) {
        toast.show({ type: 'error', text: 'Install MetaMask to continue.' });
        return;
      }
      const accounts = (await client.request({
        method: 'eth_requestAccounts',
      })) as string[];
      if (accounts[0]) {
        setAddress(accounts[0] as Address);
        const nextClient = createBrowserWalletClient(accounts[0] as Address);
        if (nextClient) {
          walletRef.current = nextClient;
        }
        toast.show({ type: 'success', text: 'Wallet connected.' });
      }
      const id = await walletRef.current?.getChainId();
      setChainId(id ?? null);
    } catch (error) {
      toast.show({ type: 'error', text: errorMessage(error) });
    } finally {
      setConnecting(false);
    }
  };

  const switchToStable = async () => {
    if (!ensureWallet()) return;
    try {
      setSwitchPending(true);
      const client = walletRef.current;
      if (!client) return;
      await client.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: STABLE.hexId,
            chainName: STABLE.name,
            nativeCurrency: STABLE.nativeCurrency,
            rpcUrls: [STABLE.rpcHttp],
            blockExplorerUrls: [STABLE.explorer],
          },
        ],
      });
      await client.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: STABLE.hexId }],
      });
      const id = await client.getChainId();
      setChainId(id);
      toast.show({ type: 'success', text: 'Switched to Stable Testnet.' });
    } catch (error) {
      toast.show({ type: 'error', text: errorMessage(error) });
    } finally {
      setSwitchPending(false);
    }
  };

  const handleTx = async (
    callback: (
      client: NonNullable<ReturnType<typeof createBrowserWalletClient>>,
    ) => Promise<`0x${string}`>,
  ) => {
    const client = walletRef.current;
    if (!address || !client || !ensureWallet()) {
      if (!address) toast.show({ type: 'error', text: 'Connect your wallet first.' });
      return;
    }
    try {
      const hash = await callback(client);
      toast.show({ type: 'success', text: 'Transaction sent.', link: txUrl(hash) });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      await refreshCounts();
      await refreshBalance(address);
      return { hash, receipt };
    } catch (error) {
      toast.show({ type: 'error', text: errorMessage(error) });
      throw error;
    }
  };

  const sendGM = async () => {
    if (!address) return;
    try {
      setGmPending(true);
      await handleTx((client) =>
        client.writeContract({
          chain: STABLE,
          address: GM_ADDRESS,
          abi: GM_ABI,
          functionName: 'gm',
          args: ['GM from Stable Playground'],
          account: address,
        })
      );
    } catch {
      // surfaced via toast
    } finally {
      setGmPending(false);
    }
  };

  const sendGN = async () => {
    if (!address) return;
    try {
      setGnPending(true);
      await handleTx((client) =>
        client.writeContract({
          chain: STABLE,
          address: GN_ADDRESS,
          abi: GN_ABI,
          functionName: 'gn',
          args: ['GN from Stable Playground'],
          account: address,
        })
      );
    } catch {
      // surfaced via toast
    } finally {
      setGnPending(false);
    }
  };

  const transferNative = async () => {
    if (!address) return;
    if (!isAddress(transferTo)) {
      toast.show({ type: 'error', text: 'Enter a valid recipient.' });
      return;
    }
    let value: bigint;
    try {
      value = parseEther(transferAmount);
    } catch {
      toast.show({ type: 'error', text: 'Enter a valid amount.' });
      return;
    }
    try {
      setTransferPending(true);
      await handleTx((client) =>
        client.sendTransaction({
          chain: STABLE,
          account: address,
          to: transferTo as Address,
          value,
        })
      );
      setTransferAmount('');
      setTransferTo('');
    } catch {
      // surfaced via toast
    } finally {
      setTransferPending(false);
    }
  };

  const gmCountLabel = useMemo(() => (totalGM ? totalGM.toString() : '0'), [totalGM]);
  const gnCountLabel = useMemo(() => (totalGN ? totalGN.toString() : '0'), [totalGN]);

  const walletLabel = address ? shortenAddress(address) : 'Connect wallet';
  const walletHelper = address
    ? onStableChain
      ? 'Ready on Stable'
      : 'Wrong network'
    : 'MetaMask required';

  const deployErc20 = async () => {
    if (!address) {
      toast.show({ type: 'error', text: 'Connect your wallet first.' });
      return;
    }
    if (!erc20Name.trim() || !erc20Symbol.trim()) {
      toast.show({ type: 'error', text: 'Enter token name and symbol.' });
      return;
    }
    try {
      setErc20Pending(true);
      const result = await handleTx((client) =>
        client.deployContract({
          chain: STABLE,
          abi: MINIMAL_ERC20_ABI,
          bytecode: MINIMAL_ERC20_BYTECODE,
          account: address,
          args: [erc20Name.trim(), erc20Symbol.trim()],
        })
      );
      if (result?.receipt.contractAddress) {
        const deployed = result.receipt.contractAddress as Address;
        setRecentErc20((prev) => [deployed, ...prev].slice(0, 3));
        toast.show({
          type: 'success',
          text: 'ERC-20 deployed. View on StableScan.',
          link: addrUrl(deployed),
        });
      }
      setErc20Name('');
      setErc20Symbol('');
    } catch {
      // surfaced via toast
    } finally {
      setErc20Pending(false);
    }
  };

  const deployErc721 = async () => {
    if (!address) {
      toast.show({ type: 'error', text: 'Connect your wallet first.' });
      return;
    }
    if (!erc721Name.trim() || !erc721Symbol.trim()) {
      toast.show({ type: 'error', text: 'Enter collection name and symbol.' });
      return;
    }
    try {
      setErc721Pending(true);
      const result = await handleTx((client) =>
        client.deployContract({
          chain: STABLE,
          abi: MINIMAL_ERC721_ABI,
          bytecode: MINIMAL_ERC721_BYTECODE,
          account: address,
          args: [erc721Name.trim(), erc721Symbol.trim()],
        })
      );
      if (result?.receipt.contractAddress) {
        const deployed = result.receipt.contractAddress as Address;
        setRecentErc721((prev) => [deployed, ...prev].slice(0, 3));
        toast.show({
          type: 'success',
          text: 'ERC-721 deployed. View on StableScan.',
          link: addrUrl(deployed),
        });
      }
      setErc721Name('');
      setErc721Symbol('');
    } catch {
      // surfaced via toast
    } finally {
      setErc721Pending(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12">
        <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-[#0A251A]/95 via-[#06160F]/95 to-[#050F0A]/95 p-8 sm:p-12">
          <div className="pointer-events-none absolute -top-36 right-0 h-72 w-72 rounded-full bg-[#30d98f]/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-40px] left-[-18%] h-64 w-64 rounded-full bg-[#1c7b55]/45 blur-[140px]" />
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#30d98f]/40 bg-[#133325]/60 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-[#8cf8c9]">
                STABLE PLAYGROUND
              </span>
              <div className="space-y-5">
                <h1 className="text-4xl font-semibold leading-snug text-white md:text-[40px]">
                  Build, test, and ship on Stable Testnet
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-[#9dddc2]">
                  Minimal tooling, maximum clarity. Connect your wallet, collect gUSDT, interact with
                  Stable-native contracts, and deploy your own templates without leaving this dashboard.
                </p>
              </div>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-3">
              <Button
                variant="secondary"
                onClick={connect}
                disabled={connecting}
                className="w-full justify-between border-white/10 bg-white/10 text-sm text-white/90 backdrop-blur"
              >
                <span>{connecting ? 'Pending...' : walletLabel}</span>
                <span className="text-xs text-muted">{walletHelper}</span>
              </Button>
              {walletRef.current && !onStableChain ? (
                <Button onClick={switchToStable} disabled={switchPending} className="w-full">
                  {switchPending ? 'Pending...' : 'Switch to Stable Testnet'}
                </Button>
              ) : (
                <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-xs font-semibold uppercase tracking-[0.4em] text-[#53f2a8]">
                  Stable Testnet
                </div>
              )}
              <a
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-transparent px-5 py-3 text-sm font-semibold text-[#9dddc2] transition-colors hover:border-white/40 hover:text-white"
                href={STABLE.faucet}
                target="_blank"
                rel="noreferrer"
              >
                Open Faucet
              </a>
            </div>
          </div>
          <div className="mt-10 flex items-center gap-3 text-sm text-[#8ecbad]">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#7ef5c1]">
              Developed by
            </span>
            <a
              href="https://x.com/kuzeydurdn"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white transition-colors hover:border-white/30"
            >
              Kuzey Durden
            </a>
          </div>
        </Card>

        {!hasWallet && (
          <Card className="border border-dashed border-[#30d98f]/60 bg-transparent text-sm text-[#8ecbad]">
            Install MetaMask to interact with Stable Playground. Once installed, refresh this page to
            connect your wallet.
          </Card>
        )}

        <Card className="border border-white/10 bg-black/30">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-transparent p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[#7ef5c1]">Block</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {blockNumber ? `#${blockNumber.toString()}` : '#--------'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d2419]/70 to-transparent p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[#7ef5c1]">
                Balance
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {balance !== null ? `${formatGUSDT(balance)} gUSDT` : '—'}
              </p>
              {address && (
                <p className="mt-2 text-xs text-[#90c7aa]">
                  GM sent: {userGM?.toString() ?? '0'} · GN sent: {userGN?.toString() ?? '0'}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-transparent p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[#7ef5c1]">Wallet</p>
              {address ? (
                <div className="mt-3 space-y-2">
                  <p className="text-2xl font-semibold text-white">{shortenAddress(address)}</p>
                  <a
                    className="inline-flex items-center gap-2 text-sm text-[#7ef5c1] transition-colors hover:text-white"
                    href={addrUrl(address)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on StableScan
                  </a>
                </div>
              ) : (
                <p className="mt-3 text-2xl font-semibold text-muted">Not connected</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="space-y-10 border border-white/10 bg-black/30 p-8 lg:p-10">
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold text-white">Quick actions</h2>
            <p className="text-sm text-[#8ecbad]">
              Execute the most common flows without leaving the dashboard. Every submission links
              directly to StableScan once sent.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#2bd083]/50 bg-gradient-to-br from-[#143928]/80 to-transparent p-6">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.35em] text-[#7ef5c1]">
                <span>Send GM</span>
                <span>COUNT · {gmCountLabel}</span>
              </div>
              <p className="mt-4 text-sm text-[#8ecbad]">
                Fire the <code className="font-mono text-xs text-[#c9ffdc]">gm()</code> greeting on Stable’s shared
                contract.
              </p>
              <Button onClick={sendGM} disabled={gmDisabled} className="mt-6 w-full">
                {gmPending ? 'Pending...' : 'Send GM'}
              </Button>
              {userGM !== null && (
                <p className="mt-3 text-xs text-[#8ecbad]">You already shared {userGM.toString()} on-chain hellos.</p>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c2119]/80 to-transparent p-6">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.35em] text-[#7ef5c1]">
                <span>Send GN</span>
                <span>COUNT · {gnCountLabel}</span>
              </div>
              <p className="mt-4 text-sm text-[#8ecbad]">
                Trigger <code className="font-mono text-xs text-[#c9ffdc]">gn()</code> to signal end-of-day across the
                network.
              </p>
              <Button
                variant="secondary"
                onClick={sendGN}
                disabled={gnDisabled}
                className="mt-6 w-full justify-center"
              >
                {gnPending ? 'Pending...' : 'Send GN'}
              </Button>
              {userGN !== null && (
                <p className="mt-3 text-xs text-[#8ecbad]">You’ve already closed {userGN.toString()} on-chain days.</p>
              )}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d231a]/80 to-transparent p-6">
              <h3 className="text-lg font-semibold text-white">Transfer native gUSDT</h3>
              <p className="mt-2 text-sm text-[#8ecbad]">
                Execute direct native transfers on Stable with instant explorer visibility.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.35em] text-[#6ebf9d]">
                    Recipient
                  </label>
                  <input
                    className={`${inputClasses} mt-2`}
                    placeholder="0xRecipient"
                    value={transferTo}
                    onChange={(event) => setTransferTo(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.35em] text-[#6ebf9d]">
                    Amount (gUSDT)
                  </label>
                  <input
                    className={`${inputClasses} mt-2`}
                    placeholder="0.0"
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                  />
                </div>
                <Button onClick={transferNative} disabled={transferDisabled} className="w-full">
                  {transferPending ? 'Pending...' : 'Send gUSDT'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-8 border border-white/10 bg-black/30 p-8 lg:p-10">
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold text-white">Deploy minimal contracts</h3>
            <p className="text-sm text-[#8ecbad]">
              Launch Stable-ready ERC-20 and ERC-721 templates, then extend or mint using viem.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#11291f]/80 to-transparent p-6">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.35em] text-[#6ebf9d]">
                <span>Minimal ERC-20</span>
                {recentErc20.length > 0 && (
                  <a
                    href={addrUrl(recentErc20[0])}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#7ef5c1] transition-colors hover:text-white"
                  >
                    Latest · {shortenAddress(recentErc20[0])}
                  </a>
                )}
              </div>
              <p className="mt-4 text-sm text-[#8ecbad]">
                Owner-controlled mintable token. Deploy and mint in a single tap.
              </p>
              <div className="mt-5 space-y-3">
                <input
                  className={inputClasses}
                  placeholder="Name"
                  value={erc20Name}
                  onChange={(event) => setErc20Name(event.target.value)}
                />
                <input
                  className={inputClasses}
                  placeholder="Symbol"
                  value={erc20Symbol}
                  onChange={(event) => setErc20Symbol(event.target.value.toUpperCase())}
                />
              </div>
              <Button
                onClick={deployErc20}
                disabled={erc20Pending || !address || !onStableChain || !erc20Name.trim() || !erc20Symbol.trim()}
                className="mt-6 w-full"
              >
                {erc20Pending ? 'Pending...' : 'Deploy ERC-20'}
              </Button>
              {recentErc20.length > 0 && (
                <div className="mt-4 space-y-2 text-xs text-[#8ecbad]">
                  {recentErc20.map((addr) => (
                    <a
                      key={addr}
                      href={addrUrl(addr)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 transition-colors hover:border-white/15 hover:text-white"
                    >
                      <span>{shortenAddress(addr)}</span>
                      <span className="uppercase tracking-wide text-[#7ef5c1]">View</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#11241c]/80 to-transparent p-6">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.35em] text-[#6ebf9d]">
                <span>Minimal ERC-721</span>
                {recentErc721.length > 0 && (
                  <a
                    href={addrUrl(recentErc721[0])}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#7ef5c1] transition-colors hover:text-white"
                  >
                    Latest · {shortenAddress(recentErc721[0])}
                  </a>
                )}
              </div>
              <p className="mt-4 text-sm text-[#8ecbad]">
                Gas-efficient NFT collection scaffold with sequential token IDs.
              </p>
              <div className="mt-5 space-y-3">
                <input
                  className={inputClasses}
                  placeholder="Name"
                  value={erc721Name}
                  onChange={(event) => setErc721Name(event.target.value)}
                />
                <input
                  className={inputClasses}
                  placeholder="Symbol"
                  value={erc721Symbol}
                  onChange={(event) => setErc721Symbol(event.target.value.toUpperCase())}
                />
              </div>
              <Button
                onClick={deployErc721}
                disabled={
                  erc721Pending ||
                  !address ||
                  !onStableChain ||
                  !erc721Name.trim() ||
                  !erc721Symbol.trim()
                }
                className="mt-6 w-full"
              >
                {erc721Pending ? 'Pending...' : 'Deploy ERC-721'}
              </Button>
              {recentErc721.length > 0 && (
                <div className="mt-4 space-y-2 text-xs text-[#8ecbad]">
                  {recentErc721.map((addr) => (
                    <a
                      key={addr}
                      href={addrUrl(addr)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 transition-colors hover:border-white/15 hover:text-white"
                    >
                      <span>{shortenAddress(addr)}</span>
                      <span className="uppercase tracking-wide text-[#7ef5c1]">View</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="space-y-6 border border-white/10 bg-black/30 p-8">
          <h3 className="text-2xl font-semibold text-white">Links & resources</h3>
          <div className="space-y-3 text-sm">
            <a
              href={STABLE.explorer}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-transparent to-transparent px-4 py-3 transition-colors hover:border-white/30 hover:text-white"
            >
              <span>StableScan</span>
              <span className="text-[#8ecbad]">Explorer for Stable Testnet</span>
            </a>
            <a
              href="https://docs.stable.xyz"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-transparent to-transparent px-4 py-3 transition-colors hover:border-white/30 hover:text-white"
            >
              <span>Stable Docs</span>
              <span className="text-[#8ecbad]">Network docs, endpoints, & guides</span>
            </a>
            <a
              href="https://discord.com/invite/stablexyz"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-transparent to-transparent px-4 py-3 transition-colors hover:border-white/30 hover:text-white"
            >
              <span>Join the Discord</span>
              <span className="text-[#8ecbad]">Share feedback with the Stable crew</span>
            </a>
          </div>
        </Card>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-xs">
          <Card
            className={`space-y-3 border ${
              toastMessage.type === 'success'
                ? 'border-[#24AE72]/60 bg-[#0F2D24]/90'
                : 'border-red-400/60 bg-[#2A0F12]/80'
            }`}
          >
            <p className="text-sm">{toastMessage.text}</p>
            {toastMessage.link && (
              <a
                className="inline-flex items-center gap-2 text-sm text-[#5BE4AC] transition-colors hover:text-white"
                href={toastMessage.link}
                target="_blank"
                rel="noreferrer"
              >
                View on StableScan
              </a>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default App;
