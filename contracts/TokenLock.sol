// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenLock
 * @notice Lock ERC-20 tokens with optional linear vesting
 * @dev Supports both simple time locks and vesting schedules with cliff periods
 */
contract TokenLock is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Lock {
        address owner;
        address token;
        uint256 amount;      // Total locked amount
        uint256 claimed;     // Amount already claimed
        uint256 startTime;   // Vesting start (or lock creation for simple locks)
        uint256 endTime;     // Unlock time (simple) or vesting end
        uint256 cliffEnd;    // End of cliff period (0 for simple locks)
        bool isVesting;      // True if linear vesting, false if simple lock
    }

    // Lock ID counter
    uint256 public nextLockId;

    // Lock ID => Lock info
    mapping(uint256 => Lock) public locks;

    // User => Lock IDs
    mapping(address => uint256[]) public userLocks;

    // Events
    event LockCreated(
        uint256 indexed lockId,
        address indexed owner,
        address indexed token,
        uint256 amount,
        uint256 unlockTime,
        bool isVesting
    );

    event TokensClaimed(
        uint256 indexed lockId,
        address indexed owner,
        uint256 amount
    );

    /**
     * @notice Create a simple time lock
     * @param token Token address to lock
     * @param amount Amount to lock
     * @param unlockTime Timestamp when tokens unlock
     */
    function createLock(
        address token,
        uint256 amount,
        uint256 unlockTime
    ) external nonReentrant returns (uint256 lockId) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(unlockTime > block.timestamp, "Unlock time must be future");

        // Transfer tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Create lock
        lockId = nextLockId++;
        locks[lockId] = Lock({
            owner: msg.sender,
            token: token,
            amount: amount,
            claimed: 0,
            startTime: block.timestamp,
            endTime: unlockTime,
            cliffEnd: 0,
            isVesting: false
        });

        userLocks[msg.sender].push(lockId);

        emit LockCreated(lockId, msg.sender, token, amount, unlockTime, false);
    }

    /**
     * @notice Create a vesting lock with optional cliff
     * @param token Token address to lock
     * @param amount Total amount to vest
     * @param startTime When vesting begins
     * @param endTime When vesting completes
     * @param cliffDuration Cliff period in seconds (0 for no cliff)
     */
    function createVestingLock(
        address token,
        uint256 amount,
        uint256 startTime,
        uint256 endTime,
        uint256 cliffDuration
    ) external nonReentrant returns (uint256 lockId) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(startTime >= block.timestamp, "Start must be >= now");
        require(endTime > startTime, "End must be > start");
        require(startTime + cliffDuration <= endTime, "Cliff exceeds vesting");

        // Transfer tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Create vesting lock
        lockId = nextLockId++;
        locks[lockId] = Lock({
            owner: msg.sender,
            token: token,
            amount: amount,
            claimed: 0,
            startTime: startTime,
            endTime: endTime,
            cliffEnd: startTime + cliffDuration,
            isVesting: true
        });

        userLocks[msg.sender].push(lockId);

        emit LockCreated(lockId, msg.sender, token, amount, endTime, true);
    }

    /**
     * @notice Get the amount that can be claimed from a lock
     * @param lockId Lock ID to query
     */
    function getClaimableAmount(uint256 lockId) public view returns (uint256) {
        Lock storage lock = locks[lockId];

        if (lock.amount == 0) return 0;

        uint256 vested;

        if (lock.isVesting) {
            // Vesting lock - linear unlock
            if (block.timestamp < lock.cliffEnd) {
                // Still in cliff period
                vested = 0;
            } else if (block.timestamp >= lock.endTime) {
                // Fully vested
                vested = lock.amount;
            } else {
                // Partial vesting
                uint256 elapsed = block.timestamp - lock.startTime;
                uint256 duration = lock.endTime - lock.startTime;
                vested = (lock.amount * elapsed) / duration;
            }
        } else {
            // Simple lock - all or nothing
            if (block.timestamp >= lock.endTime) {
                vested = lock.amount;
            } else {
                vested = 0;
            }
        }

        // Return unclaimed vested amount
        return vested > lock.claimed ? vested - lock.claimed : 0;
    }

    /**
     * @notice Claim unlocked tokens
     * @param lockId Lock ID to claim from
     */
    function withdraw(uint256 lockId) external nonReentrant {
        Lock storage lock = locks[lockId];

        require(lock.owner == msg.sender, "Not lock owner");
        require(lock.amount > 0, "Lock not found");

        uint256 claimable = getClaimableAmount(lockId);
        require(claimable > 0, "Nothing to claim");

        lock.claimed += claimable;

        IERC20(lock.token).safeTransfer(msg.sender, claimable);

        emit TokensClaimed(lockId, msg.sender, claimable);
    }

    /**
     * @notice Get lock details
     * @param lockId Lock ID to query
     */
    function getLock(uint256 lockId) external view returns (
        address owner,
        address token,
        uint256 amount,
        uint256 claimed,
        uint256 startTime,
        uint256 endTime,
        uint256 cliffEnd,
        bool isVesting
    ) {
        Lock storage lock = locks[lockId];
        return (
            lock.owner,
            lock.token,
            lock.amount,
            lock.claimed,
            lock.startTime,
            lock.endTime,
            lock.cliffEnd,
            lock.isVesting
        );
    }

    /**
     * @notice Get all lock IDs for a user
     * @param user User address
     */
    function getUserLocks(address user) external view returns (uint256[] memory) {
        return userLocks[user];
    }

    /**
     * @notice Get lock count for a user
     * @param user User address
     */
    function getUserLockCount(address user) external view returns (uint256) {
        return userLocks[user].length;
    }
}
