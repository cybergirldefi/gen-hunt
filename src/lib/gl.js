import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'
import {
  TransactionStatus,
  ExecutionResult,
} from 'genlayer-js/types'


export const CHAIN_ID = '0x107D'

export const NET = {
  chainId: CHAIN_ID,
  chainName: 'GenLayer Bradbury',
  rpcUrls: ['https://rpc-bradbury.genlayer.com'],
  nativeCurrency: {
    name: 'GEN',
    symbol: 'GEN',
    decimals: 18,
  },
  blockExplorerUrls: [
    'https://explorer-bradbury.genlayer.com',
  ],
}


const readClient = createClient({
  chain: testnetBradbury,
})


const cache = new Map()
const CACHE_TTL = 30_000


function errorMessage(error) {
  if (!error) return 'Unknown transaction error'

  if (typeof error === 'string') return error

  return (
    error.shortMessage ||
    error.details ||
    error.message ||
    'Transaction failed'
  )
}


export async function switchToBradbury() {
  if (!window.ethereum) {
    throw new Error('Install MetaMask or Rabby')
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID }],
    })
  } catch (error) {
    if (
      error?.code === 4902 ||
      error?.code === -32603
    ) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [NET],
      })
      return
    }

    throw error
  }
}


export async function readContract(
  address,
  method,
  args = [],
  useCache = false,
) {
  const key = `${address}:${method}:${JSON.stringify(args)}`

  if (useCache) {
    const existing = cache.get(key)

    if (
      existing &&
      Date.now() - existing.timestamp < CACHE_TTL
    ) {
      return existing.value
    }
  }

  try {
    const value = await readClient.readContract({
      address,
      functionName: method,
      args,
      stateStatus: 'accepted',
    })

    if (useCache) {
      cache.set(key, {
        value,
        timestamp: Date.now(),
      })
    }

    return value
  } catch (error) {
    throw new Error(errorMessage(error))
  }
}


export async function writeContract(
  address,
  account,
  method,
  args = [],
  valueWei = 0n,
  leaderOnly = true,
) {
  if (!window.ethereum) {
    throw new Error('Install MetaMask or Rabby')
  }

  if (!account) {
    throw new Error('Connect your wallet first')
  }

  const client = createClient({
    chain: testnetBradbury,
    account,
    provider: window.ethereum,
  })

  try {
    await switchToBradbury()

    return await client.writeContract({
      address,
      functionName: method,
      args,
      value: BigInt(valueWei || 0),
      leaderOnly,
    })
  } catch (error) {
    throw new Error(errorMessage(error))
  }
}


export async function waitTx(
  hash,
  onSlow,
) {
  let slowTimer

  if (onSlow) {
    slowTimer = setTimeout(() => {
      onSlow()
    }, 30_000)
  }

  try {
    /*
     * For dapp UX we wait for ACCEPTED, not FINALIZED.
     *
     * Once ACCEPTED, GenLayer state is available through
     * reads using stateStatus: 'accepted'.
     *
     * FINALIZED may take substantially longer and caused the
     * previous UI to report a timeout while the transaction
     * was still committing successfully.
     */
    const receipt =
      await readClient.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        interval: 3000,
        retries: 180,
        fullTransaction: false,
      })

    /*
     * ACCEPTED transactions should already contain their
     * execution result. If the SDK returns it, enforce it.
     */
    const execution =
      receipt?.txExecutionResultName

    if (
      execution ===
      ExecutionResult.FINISHED_WITH_ERROR
    ) {
      const reason =
        receipt?.txExecutionResult?.error ||
        receipt?.executionResult?.error ||
        'Contract execution failed'

      throw new Error(reason)
    }

    /*
     * Some Bradbury responses may not immediately expose
     * txExecutionResultName even though the tx is ACCEPTED.
     * Do not treat that as a failed transaction.
     */
    return receipt
  } catch (error) {
    throw new Error(errorMessage(error))
  } finally {
    if (slowTimer) {
      clearTimeout(slowTimer)
    }
  }
}


export function clearReadCache() {
  cache.clear()
}
