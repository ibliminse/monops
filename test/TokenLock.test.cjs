const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TokenLock", function () {
  let tokenLock;
  let mockToken;
  let owner;
  let addr1;
  let addr2;

  const ONE_DAY = 24 * 60 * 60;
  const ONE_MONTH = 30 * ONE_DAY;
  const AMOUNT = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy mock token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Test Token", "TEST", 18);
    await mockToken.waitForDeployment();

    // Deploy TokenLock
    const TokenLock = await ethers.getContractFactory("TokenLock");
    tokenLock = await TokenLock.deploy();
    await tokenLock.waitForDeployment();

    // Mint tokens to owner
    await mockToken.mint(owner.address, ethers.parseEther("100000"));
    await mockToken.approve(await tokenLock.getAddress(), ethers.parseEther("100000"));
  });

  describe("Deployment", function () {
    it("Should set nextLockId to 0", async function () {
      expect(await tokenLock.nextLockId()).to.equal(0);
    });
  });

  describe("createLock", function () {
    it("Should create a simple lock successfully", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await expect(
        tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime)
      ).to.emit(tokenLock, "LockCreated");

      expect(await tokenLock.nextLockId()).to.equal(1);
    });

    it("Should transfer tokens to contract", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;
      const contractAddress = await tokenLock.getAddress();

      const balanceBefore = await mockToken.balanceOf(contractAddress);
      await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);
      const balanceAfter = await mockToken.balanceOf(contractAddress);

      expect(balanceAfter - balanceBefore).to.equal(AMOUNT);
    });

    it("Should store lock data correctly", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

      const lock = await tokenLock.getLock(0);
      expect(lock.owner).to.equal(owner.address);
      expect(lock.token).to.equal(await mockToken.getAddress());
      expect(lock.amount).to.equal(AMOUNT);
      expect(lock.claimed).to.equal(0);
      expect(lock.endTime).to.equal(unlockTime);
      expect(lock.cliffEnd).to.equal(0);
      expect(lock.isVesting).to.equal(false);
    });

    it("Should track user locks", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

      const userLocks = await tokenLock.getUserLocks(owner.address);
      expect(userLocks.length).to.equal(1);
      expect(userLocks[0]).to.equal(0);
    });

    it("Should revert with invalid token (zero address)", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await expect(
        tokenLock.createLock(ethers.ZeroAddress, AMOUNT, unlockTime)
      ).to.be.revertedWith("Invalid token");
    });

    it("Should revert with zero amount", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await expect(
        tokenLock.createLock(await mockToken.getAddress(), 0, unlockTime)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should revert with unlock time in the past", async function () {
      const unlockTime = (await time.latest()) - 60;

      await expect(
        tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime)
      ).to.be.revertedWith("Unlock time must be future");
    });
  });

  describe("createVestingLock", function () {
    it("Should create a vesting lock successfully", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const cliffDuration = ONE_DAY * 7;

      await expect(
        tokenLock.createVestingLock(
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          cliffDuration
        )
      ).to.emit(tokenLock, "LockCreated");

      expect(await tokenLock.nextLockId()).to.equal(1);
    });

    it("Should store vesting lock data correctly", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const cliffDuration = ONE_DAY * 7;

      await tokenLock.createVestingLock(
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        cliffDuration
      );

      const lock = await tokenLock.getLock(0);
      expect(lock.owner).to.equal(owner.address);
      expect(lock.token).to.equal(await mockToken.getAddress());
      expect(lock.amount).to.equal(AMOUNT);
      expect(lock.claimed).to.equal(0);
      expect(lock.startTime).to.equal(startTime);
      expect(lock.endTime).to.equal(endTime);
      expect(lock.cliffEnd).to.equal(startTime + cliffDuration);
      expect(lock.isVesting).to.equal(true);
    });

    it("Should create vesting lock without cliff", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await tokenLock.createVestingLock(
        await mockToken.getAddress(),
        AMOUNT,
        startTime,
        endTime,
        0
      );

      const lock = await tokenLock.getLock(0);
      expect(lock.cliffEnd).to.equal(startTime); // cliffEnd = startTime + 0
      expect(lock.isVesting).to.equal(true);
    });

    it("Should revert with invalid token", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await expect(
        tokenLock.createVestingLock(ethers.ZeroAddress, AMOUNT, startTime, endTime, 0)
      ).to.be.revertedWith("Invalid token");
    });

    it("Should revert with zero amount", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;

      await expect(
        tokenLock.createVestingLock(
          await mockToken.getAddress(),
          0,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should revert with start time in the past", async function () {
      const startTime = (await time.latest()) - 60;
      const endTime = startTime + ONE_MONTH;

      await expect(
        tokenLock.createVestingLock(
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("Start must be >= now");
    });

    it("Should revert with end time before start time", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime - 1;

      await expect(
        tokenLock.createVestingLock(
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        )
      ).to.be.revertedWith("End must be > start");
    });

    it("Should revert with cliff exceeding vesting period", async function () {
      const startTime = (await time.latest()) + 60;
      const endTime = startTime + ONE_MONTH;
      const cliffDuration = ONE_MONTH + ONE_DAY;

      await expect(
        tokenLock.createVestingLock(
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          cliffDuration
        )
      ).to.be.revertedWith("Cliff exceeds vesting");
    });
  });

  describe("getClaimableAmount", function () {
    describe("Simple Lock", function () {
      it("Should return 0 before unlock time", async function () {
        const unlockTime = (await time.latest()) + ONE_MONTH;

        await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

        expect(await tokenLock.getClaimableAmount(0)).to.equal(0);
      });

      it("Should return full amount after unlock time", async function () {
        const unlockTime = (await time.latest()) + ONE_MONTH;

        await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

        await time.increase(ONE_MONTH + ONE_DAY);

        expect(await tokenLock.getClaimableAmount(0)).to.equal(AMOUNT);
      });
    });

    describe("Vesting Lock", function () {
      it("Should return 0 during cliff period", async function () {
        const startTime = (await time.latest()) + 60;
        const endTime = startTime + ONE_MONTH;
        const cliffDuration = ONE_DAY * 7;

        await tokenLock.createVestingLock(
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          cliffDuration
        );

        // Move to after start but before cliff ends
        await time.increase(60 + ONE_DAY);

        expect(await tokenLock.getClaimableAmount(0)).to.equal(0);
      });

      it("Should return partial amount during vesting", async function () {
        const startTime = (await time.latest()) + 60;
        const endTime = startTime + ONE_MONTH;

        await tokenLock.createVestingLock(
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        );

        // Move to 50% through the vesting period
        await time.increase(60 + ONE_MONTH / 2);

        const claimable = await tokenLock.getClaimableAmount(0);
        expect(claimable).to.be.closeTo(AMOUNT / 2n, ethers.parseEther("1"));
      });

      it("Should return full amount after vesting ends", async function () {
        const startTime = (await time.latest()) + 60;
        const endTime = startTime + ONE_MONTH;

        await tokenLock.createVestingLock(
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        );

        await time.increase(60 + ONE_MONTH + ONE_DAY);

        expect(await tokenLock.getClaimableAmount(0)).to.equal(AMOUNT);
      });

      it("Should account for already claimed amount", async function () {
        const startTime = (await time.latest()) + 60;
        const endTime = startTime + ONE_MONTH;

        await tokenLock.createVestingLock(
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        );

        // Move to 50% and claim
        await time.increase(60 + ONE_MONTH / 2);
        await tokenLock.withdraw(0);

        // Claimable should be near 0 right after claiming
        const claimable = await tokenLock.getClaimableAmount(0);
        expect(claimable).to.be.closeTo(0n, ethers.parseEther("1"));
      });
    });

    it("Should return 0 for non-existent lock", async function () {
      expect(await tokenLock.getClaimableAmount(999)).to.equal(0);
    });
  });

  describe("withdraw", function () {
    describe("Simple Lock", function () {
      it("Should withdraw full amount after unlock", async function () {
        const unlockTime = (await time.latest()) + ONE_MONTH;

        await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

        await time.increase(ONE_MONTH + ONE_DAY);

        const balanceBefore = await mockToken.balanceOf(owner.address);
        await tokenLock.withdraw(0);
        const balanceAfter = await mockToken.balanceOf(owner.address);

        expect(balanceAfter - balanceBefore).to.equal(AMOUNT);
      });

      it("Should emit TokensClaimed event", async function () {
        const unlockTime = (await time.latest()) + ONE_MONTH;

        await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

        await time.increase(ONE_MONTH + ONE_DAY);

        await expect(tokenLock.withdraw(0))
          .to.emit(tokenLock, "TokensClaimed")
          .withArgs(0, owner.address, AMOUNT);
      });
    });

    describe("Vesting Lock", function () {
      it("Should allow partial withdrawals", async function () {
        const startTime = (await time.latest()) + 60;
        const endTime = startTime + ONE_MONTH;

        await tokenLock.createVestingLock(
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        );

        // First withdrawal at 50%
        await time.increase(60 + ONE_MONTH / 2);
        const balanceBefore1 = await mockToken.balanceOf(owner.address);
        await tokenLock.withdraw(0);
        const balanceAfter1 = await mockToken.balanceOf(owner.address);
        const firstWithdrawal = balanceAfter1 - balanceBefore1;

        // Second withdrawal at end
        await time.increase(ONE_MONTH / 2 + ONE_DAY);
        const balanceBefore2 = await mockToken.balanceOf(owner.address);
        await tokenLock.withdraw(0);
        const balanceAfter2 = await mockToken.balanceOf(owner.address);
        const secondWithdrawal = balanceAfter2 - balanceBefore2;

        // Total should equal AMOUNT
        expect(firstWithdrawal + secondWithdrawal).to.be.closeTo(
          AMOUNT,
          ethers.parseEther("1")
        );
      });

      it("Should update claimed amount", async function () {
        const startTime = (await time.latest()) + 60;
        const endTime = startTime + ONE_MONTH;

        await tokenLock.createVestingLock(
          await mockToken.getAddress(),
          AMOUNT,
          startTime,
          endTime,
          0
        );

        await time.increase(60 + ONE_MONTH + ONE_DAY);
        await tokenLock.withdraw(0);

        const lock = await tokenLock.getLock(0);
        expect(lock.claimed).to.equal(AMOUNT);
      });
    });

    it("Should revert if not lock owner", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

      await time.increase(ONE_MONTH + ONE_DAY);

      await expect(tokenLock.connect(addr1).withdraw(0)).to.be.revertedWith(
        "Not lock owner"
      );
    });

    it("Should revert with nothing to claim", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

      // Try to withdraw before unlock
      await expect(tokenLock.withdraw(0)).to.be.revertedWith("Nothing to claim");
    });

    it("Should revert for non-existent lock", async function () {
      // Non-existent lock has owner = address(0), so it fails "Not lock owner" check first
      await expect(tokenLock.withdraw(999)).to.be.revertedWith("Not lock owner");
    });
  });

  describe("View functions", function () {
    it("getUserLocks should return all user lock IDs", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);
      await tokenLock.createLock(
        await mockToken.getAddress(),
        AMOUNT,
        unlockTime + ONE_MONTH
      );

      const locks = await tokenLock.getUserLocks(owner.address);
      expect(locks.length).to.equal(2);
      expect(locks[0]).to.equal(0);
      expect(locks[1]).to.equal(1);
    });

    it("getUserLockCount should return correct count", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);
      await tokenLock.createLock(
        await mockToken.getAddress(),
        AMOUNT,
        unlockTime + ONE_MONTH
      );

      expect(await tokenLock.getUserLockCount(owner.address)).to.equal(2);
    });

    it("getUserLockCount should return 0 for user with no locks", async function () {
      expect(await tokenLock.getUserLockCount(addr1.address)).to.equal(0);
    });

    it("getLock should return all lock details", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

      const lock = await tokenLock.getLock(0);
      expect(lock.owner).to.equal(owner.address);
      expect(lock.token).to.equal(await mockToken.getAddress());
      expect(lock.amount).to.equal(AMOUNT);
      expect(lock.claimed).to.equal(0);
      expect(lock.endTime).to.equal(unlockTime);
      expect(lock.isVesting).to.equal(false);
    });
  });

  describe("Multiple users", function () {
    it("Should handle multiple users creating locks", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      // Owner creates lock
      await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

      // Mint and approve for addr1
      await mockToken.mint(addr1.address, AMOUNT);
      await mockToken
        .connect(addr1)
        .approve(await tokenLock.getAddress(), AMOUNT);
      await tokenLock
        .connect(addr1)
        .createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

      expect(await tokenLock.getUserLockCount(owner.address)).to.equal(1);
      expect(await tokenLock.getUserLockCount(addr1.address)).to.equal(1);

      const ownerLocks = await tokenLock.getUserLocks(owner.address);
      const addr1Locks = await tokenLock.getUserLocks(addr1.address);

      expect(ownerLocks[0]).to.equal(0);
      expect(addr1Locks[0]).to.equal(1);
    });

    it("Users should only be able to withdraw their own locks", async function () {
      const unlockTime = (await time.latest()) + ONE_MONTH;

      await tokenLock.createLock(await mockToken.getAddress(), AMOUNT, unlockTime);

      await time.increase(ONE_MONTH + ONE_DAY);

      // addr1 should not be able to withdraw owner's lock
      await expect(tokenLock.connect(addr1).withdraw(0)).to.be.revertedWith(
        "Not lock owner"
      );

      // owner should be able to withdraw
      await expect(tokenLock.withdraw(0)).to.not.be.reverted;
    });
  });
});
